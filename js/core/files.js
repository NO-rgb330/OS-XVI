/* File-level helpers shared by the desktop and the file manager:
   icon choice, "open with", and create / rename / delete flows with validation. */

import * as vfs from './vfs.js';
import * as dialogs from './dialogs.js';
import { openWindow } from './wm.js';
import { extOf, joinPath, nameError } from './util.js';

export const TEXT = new Set(['txt', 'md', 'js', 'json', 'css', 'html', 'log', 'csv', 'xml', 'yml', 'yaml', 'ini', 'sh', 'py', 'ts']);
export const IMAGE = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico']);
export const AUDIO = new Set(['mp3', 'wav', 'ogg', 'oga', 'opus', 'flac', 'm4a', 'aac', 'weba']);
export const VIDEO = new Set(['mp4', 'm4v', 'webm', 'ogv', 'mkv', 'mov']);
export const MEDIA = new Set([...AUDIO, ...VIDEO]);

/** 'image' | 'audio' | 'video' | 'text' | 'other' */
export function kindOf(name) {
  const ext = extOf(name);
  if (IMAGE.has(ext)) return 'image';
  if (AUDIO.has(ext)) return 'audio';
  if (VIDEO.has(ext)) return 'video';
  if (TEXT.has(ext)) return 'text';
  return 'other';
}

export const isImage = (name) => IMAGE.has(extOf(name));
export const isMedia = (name) => MEDIA.has(extOf(name));

/** Sprite icon id for a vfs node. */
export function iconFor(item) {
  if (item.kind === 'dir') return 'folder';
  const ext = extOf(item.name);
  if (TEXT.has(ext)) return 'file-text';
  if (IMAGE.has(ext)) return 'file-image';
  if (AUDIO.has(ext)) return 'file-audio';
  if (VIDEO.has(ext)) return 'file-video';
  return 'file';
}

export function openItem(path, kind, name) {
  if (kind === 'dir') return openWindow('files', { path });
  const k = kindOf(name);
  if (k === 'text') return openWindow('notepad', { path });
  if (k === 'image') return openWindow('imageviewer', { path });
  if (k === 'audio' || k === 'video') return openWindow('mediaviewer', { path });
  return dialogs.alert('Open File', `No app is available to open "${name}" yet.`);
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
  if (await vfs.exists(path)) { await dialogs.alert('Error', `"${name}" already exists.`); return null; }
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
    await dialogs.alert('Error', e.message.startsWith('EEXIST') ? `"${name}" already exists.` : e.message);
    return null;
  }
}

/** Confirms and deletes. Returns true if anything was deleted. */
export async function deleteEntries(dir, names) {
  if (!names.length) return false;
  const what = names.length === 1 ? `"${names[0]}"` : `${names.length} items`;
  if (!(await dialogs.confirm('Delete', `Delete ${what}? This cannot be undone.`, 'Delete'))) return false;
  try {
    for (const name of names) await vfs.rm(joinPath(dir, name));
  } catch (e) {
    await dialogs.alert('Error', e.message);
  }
  return true;
}

/**
 * Move (or copy) entries between folders, renaming on collision ("name (2).ext").
 * `beforeEach(finalName)` runs just before each operation. Never throws:
 * returns { done: [{ from, to }], errors: [message] }.
 */
export async function transferInto(srcDir, names, dstDir, { copy = false, beforeEach } = {}) {
  const done = [], errors = [];
  for (const name of names) {
    try {
      if (!copy && srcDir === dstDir) continue;
      const src = joinPath(srcDir, name);
      const finalName = copy || (await vfs.exists(joinPath(dstDir, name))) ? await uniqueName(dstDir, name) : name;
      beforeEach?.(finalName);
      const dst = joinPath(dstDir, finalName);
      if (copy) await vfs.cp(src, dst); else await vfs.mv(src, dst);
      done.push({ from: name, to: finalName });
    } catch (e) {
      errors.push(`${name}: ${e.message.replace(/^E[A-Z]+: /, '')}`);
    }
  }
  return { done, errors };
}
