/* File-level helpers shared by the desktop and the file manager:
   icon choice, "open with", and create / rename / delete flows with validation.

   Nodes of kind 'app' are application shortcuts (no blob, protected inside
   SYSTEM APPS). They open by launching the referenced app, show the app's
   icon, and can be copied out of SYSTEM APPS but not moved or deleted from
   there. */

import * as vfs from './vfs.js';
import * as dialogs from './dialogs.js';
import { openWindow } from './wm.js';
import { get as getApp } from './registry.js';
import { extOf, joinPath, parentPath, baseName, formatBytes, nameError } from './util.js';
import { listZip, readEntry, safeSegments } from './zip.js';

export const TEXT = new Set(['txt', 'md', 'js', 'json', 'css', 'html', 'log', 'csv', 'xml', 'yml', 'yaml', 'ini', 'sh', 'py', 'ts']);
export const IMAGE = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico']);
export const AUDIO = new Set(['mp3', 'wav', 'ogg', 'oga', 'opus', 'flac', 'm4a', 'aac', 'weba']);
export const VIDEO = new Set(['mp4', 'm4v', 'webm', 'ogv', 'mkv', 'mov']);
export const MEDIA = new Set([...AUDIO, ...VIDEO]);
export const ARCHIVE = new Set(['zip']);

/** 'image' | 'audio' | 'video' | 'text' | 'archive' | 'other' */
export function kindOf(name) {
  const ext = extOf(name);
  if (IMAGE.has(ext)) return 'image';
  if (AUDIO.has(ext)) return 'audio';
  if (VIDEO.has(ext)) return 'video';
  if (TEXT.has(ext)) return 'text';
  if (ARCHIVE.has(ext)) return 'archive';
  return 'other';
}

export const isImage = (name) => IMAGE.has(extOf(name));
export const isMedia = (name) => MEDIA.has(extOf(name));
export const isArchive = (name) => ARCHIVE.has(extOf(name));

/** Sprite icon id for a vfs node (file, dir, or app shortcut). */
export function iconFor(item) {
  if (item.kind === 'app') {
    const app = getApp(item.appId);
    return app?.icon ?? 'file';
  }
  if (item.kind === 'dir') return 'folder';
  const ext = extOf(item.name);
  if (TEXT.has(ext)) return 'file-text';
  if (IMAGE.has(ext)) return 'file-image';
  if (AUDIO.has(ext)) return 'file-audio';
  if (VIDEO.has(ext)) return 'file-video';
  if (ARCHIVE.has(ext)) return 'file-archive';
  return 'file';
}

/**
 * Open a vfs node.
 *   kind 'app'  → launch the app (or explain why the shortcut is broken)
 *   kind 'dir'  → Files window at that path
 *   files       → dispatch by extension
 *   archive     → extract with confirmation
 * `appId` is required when kind is 'app' — pass item.appId from the caller.
 */
export function openItem(path, kind, name, appId = null) {
  if (kind === 'app') {
    if (!appId) return dialogs.alert('Open App', `The shortcut “${name}” is missing its app id.`);
    const app = getApp(appId);
    if (!app) return dialogs.alert('Open App', `The app “${name}” is no longer installed.`);
    return openWindow(appId);
  }
  if (kind === 'dir') return openWindow('files', { path });
  const k = kindOf(name);
  if (k === 'text') return openWindow('notepad', { path });
  if (k === 'image') return openWindow('imageviewer', { path });
  if (k === 'audio' || k === 'video') return openWindow('mediaviewer', { path });
  if (k === 'archive') return extractArchive(path, { ask: true });
  return dialogs.alert('Open File', `No app is available to open “${name}” yet.`);
}

export async function uniqueName(dir, name) {
  if (!(await vfs.exists(joinPath(dir, name)))) return name;
  const dot = name.lastIndexOf('.');
  const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
  for (let i = 2; ; i++) {
    const candidate = `${stem} (${i})${ext}`;
    if (!(await vfs.exists(joinPath(dir, candidate)))) return candidate;
  }
}

/** Prompts for a name and creates a folder or empty text file. Returns the name, or null. */
export async function createEntry(dir, kind) {
  const isDir = kind === 'dir';
  const input = await dialogs.prompt(
    isDir ? 'New Folder' : 'New Text File',
    isDir ? 'Folder name:' : 'File name:',
    await uniqueName(dir, isDir ? 'New Folder' : 'untitled.txt'));
  if (input == null) return null;
  const name = input.trim();
  const err = nameError(name);
  if (err) { await dialogs.alert('Error', err); return null; }
  const path = joinPath(dir, name);
  if (await vfs.exists(path)) { await dialogs.alert('Error', `“${name}” already exists.`); return null; }
  try {
    if (isDir) await vfs.mkdir(path); else await vfs.write(path, '');
    return name;
  } catch (e) {
    await dialogs.alert('Error', e.message);
    return null;
  }
}

/** Prompts for a new name and renames. Returns the new name, or null. */
export async function renameEntry(dir, oldName) {
  const input = await dialogs.prompt('Rename', 'Enter new name:', oldName);
  if (input == null) return null;
  const name = input.trim();
  if (name === oldName) return null;
  const err = nameError(name);
  if (err) { await dialogs.alert('Error', err); return null; }
  try {
    await vfs.mv(joinPath(dir, oldName), joinPath(dir, name));
    return name;
  } catch (e) {
    await dialogs.alert('Error', e.message.startsWith('EEXIST') ? `“${name}” already exists.` : e.message);
    return null;
  }
}

/**
 * Confirms and deletes. Protected entries are refused up-front with a clear
 * message instead of letting vfs throw EPERM mid-loop.
 */
export async function deleteEntries(dir, names) {
  if (!names.length) return false;

  const deletable = [];
  const protectedNames = [];
  for (const name of names) {
    try {
      const st = await vfs.stat(joinPath(dir, name));
      if (st.protected) protectedNames.push(name); else deletable.push(name);
    } catch { /* skip missing — nothing to delete */ }
  }

  if (protectedNames.length) {
    const what = protectedNames.length === 1 ? `“${protectedNames[0]}”` : `${protectedNames.length} protected items`;
    await dialogs.alert('Delete', `${what} ${protectedNames.length === 1 ? 'is' : 'are'} part of the system and can’t be deleted.`);
    if (!deletable.length) return false;
  }
  if (!deletable.length) return false;

  const what = deletable.length === 1 ? `“${deletable[0]}”` : `${deletable.length} items`;
  if (!(await dialogs.confirm('Delete', `Delete ${what}? This cannot be undone.`, 'Delete'))) return false;
  try {
    for (const name of deletable) await vfs.rm(joinPath(dir, name));
  } catch (e) {
    await dialogs.alert('Error', e.message);
  }
  return true;
}

/**
 * Move (or copy) entries between folders, renaming on collision.
 * A move from a protected source silently becomes a copy — the original
 * stays untouched, the destination gets a fresh unprotected entry. This
 * is what makes "drag an app from SYSTEM APPS to the desktop" work as the
 * user expects without an error.
 *
 * Returns { done: [{ from, to }], errors: [message] }.
 */
export async function transferInto(srcDir, names, dstDir, { copy = false, beforeEach } = {}) {
  const done = [], errors = [];
  for (const name of names) {
    try {
      if (!copy && srcDir === dstDir) continue;
      const src = joinPath(srcDir, name);

      let opCopy = copy;
      if (!opCopy) {
        try {
          const st = await vfs.stat(src);
          if (st.protected) opCopy = true;
        } catch { /* surface below */ }
      }

      const finalName = opCopy || (await vfs.exists(joinPath(dstDir, name)))
        ? await uniqueName(dstDir, name)
        : name;
      beforeEach?.(finalName);
      const dst = joinPath(dstDir, finalName);
      if (opCopy) await vfs.cp(src, dst); else await vfs.mv(src, dst);
      done.push({ from: name, to: finalName });
    } catch (e) {
      errors.push(`${name}: ${e.message.replace(/^E[A-Z]+: /, '')}`);
    }
  }
  return { done, errors };
}

// ---------- Zip extraction ----------

const tick = () => new Promise((r) => setTimeout(r));

/**
 * Extract a .zip stored on the virtual disk.
 *   here:false (default) → into a new folder named after the archive, beside it
 *   here:true            → straight into the archive's own folder
 *   ask:true             → confirm first (used when the user simply opens the archive)
 * Existing files are never overwritten: clashes become “name (2).ext”.
 * Returns { dir, name } (name = new folder's name, or null for "here"), or null if nothing happened.
 */
export async function extractArchive(path, { here = false, ask = false } = {}) {
  const name = baseName(path);
  const dir = parentPath(path);
  const stem = name.replace(/\.zip$/i, '') || 'archive';

  if (ask && !(await dialogs.confirm('Extract Archive', `Extract “${name}” into a new folder “${stem}”?`, 'Extract'))) return null;

  let file, entries;
  try {
    file = await vfs.read(path);
    entries = await listZip(file);
  } catch (e) {
    await dialogs.alert('Extract Archive', `“${name}” can’t be opened.\n${e.message.replace(/^E[A-Z]+: /, '')}`);
    return null;
  }
  const jobs = entries.filter((e) => !e.isSymlink);
  const skippedLinks = entries.length - jobs.length;
  if (!jobs.length) { await dialogs.alert('Extract Archive', `“${name}” is empty.`); return null; }

  const need = jobs.reduce((n, e) => n + (e.isDir ? 0 : e.usize), 0);
  const { free } = await vfs.usage();
  if (need > free) {
    await dialogs.alert('Extract Archive',
      `Not enough disk space to extract “${name}”.\nNeeds ${formatBytes(need)}, ${formatBytes(free)} left.`);
    return null;
  }

  let dest = dir;
  const prog = dialogs.progress(`Extracting ${name}`);
  const failed = [];
  let files = 0, bytes = 0, done = 0;
  const made = new Set();

  const mkdirs = async (segs) => {
    let cur = dest;
    for (const s of segs) {
      cur = joinPath(cur, s);
      if (made.has(cur)) continue;
      await vfs.mkdir(cur);
      made.add(cur);
    }
    return cur;
  };

  try {
    if (!here) {
      dest = joinPath(dir, await uniqueName(dir, stem));
      await vfs.mkdir(dest);
    }
    for (let i = 0; i < jobs.length && !prog.cancelled; i++) {
      const e = jobs[i];
      prog.update(`${i + 1} of ${jobs.length} — ${e.name}`, need ? done / need : i / jobs.length);
      if (i % 8 === 0) await tick();

      const segs = safeSegments(e.name);
      const bad = segs && segs.map(nameError).find(Boolean);
      if (!segs || bad) { failed.push(`${e.name}: ${segs ? bad : 'unsafe path skipped'}`); continue; }
      try {
        if (e.isDir) { await mkdirs(segs); continue; }
        const parent = await mkdirs(segs.slice(0, -1));
        const blob = await readEntry(file, e);
        const finalName = await uniqueName(parent, segs[segs.length - 1]);
        await vfs.write(joinPath(parent, finalName), blob);
        files++; bytes += e.usize; done += e.usize;
      } catch (err) {
        const why = err.message.replace(/^E[A-Z]+: /, '');
        failed.push(`${e.name}: ${why}`);
        if (/ENOSPC|disk space/i.test(err.message)) break;
      }
    }
  } catch (err) {
    failed.push(err.message.replace(/^E[A-Z]+: /, ''));
  }
  const cancelled = prog.cancelled;
  prog.close();

  const where = here ? `“${baseName(dir) || 'File System'}”` : `“${baseName(dest)}”`;
  if (files || !failed.length) {
    dialogs.toast(cancelled
      ? `Extraction cancelled — ${files} file${files === 1 ? '' : 's'} extracted to ${where}`
      : `Extracted ${files} file${files === 1 ? '' : 's'} (${formatBytes(bytes)}) to ${where}`);
  }
  if (failed.length || skippedLinks) {
    const lines = failed.slice(0, 8);
    if (failed.length > 8) lines.push(`…and ${failed.length - 8} more`);
    if (skippedLinks) lines.push(`${skippedLinks} symbolic link${skippedLinks === 1 ? '' : 's'} skipped`);
    await dialogs.alert('Extract Archive', `${failed.length ? `${failed.length} item${failed.length === 1 ? '' : 's'} couldn’t be extracted:\n` : ''}${lines.join('\n')}`);
  }
  return { dir: dest, name: here ? null : baseName(dest) };
}
