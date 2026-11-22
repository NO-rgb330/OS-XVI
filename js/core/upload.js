/* Getting files from the user's computer into the virtual disk.
   Everything uploaded lands in /home/user/UPLOADS.

   Folder uploads are supported two ways:
     · pickFiles({ directory: true }) — native folder picker. Browsers report
       each File's `webkitRelativePath` ('photos/2024/beach.jpg'), so the tree
       is recreated under UPLOADS. Empty subfolders are lost — a browser
       limitation of <input webkitdirectory>.
     · Drag-and-drop of a folder — see filesFromDrop in dnd.js, which attaches
       a `relativePath` to each File. Empty folders ARE preserved this way.
*/

import * as vfs from './vfs.js';
import { toast } from './dialogs.js';
import { joinPath, formatBytes, nameError } from './util.js';

export const UPLOADS_DIR = '/home/user/UPLOADS';

/**
 * Open the browser's file (or folder) chooser.
 * `directory: true` switches to a folder picker; `multiple` becomes implicit.
 * Resolves with the chosen File[] ([] if cancelled). Folder-picked files carry
 * `webkitRelativePath` set by the browser.
 */
export function pickFiles({ accept = '', multiple = true, directory = false } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = multiple;
    if (accept) input.accept = accept;
    if (directory) {
      input.webkitdirectory = true;
      input.setAttribute('webkitdirectory', '');
      input.setAttribute('directory', '');        // alternate spelling for older engines
    }
    input.style.display = 'none';
    document.body.appendChild(input);
    const finish = () => { input.remove(); };
    input.addEventListener('change', () => { resolve(Array.from(input.files ?? [])); finish(); });
    input.addEventListener('cancel', () => { resolve([]); finish(); });
    input.click();
  });
}

/**
 * Copy browser File objects into UPLOADS (never overwriting: duplicates become "name (2).ext").
 * Subfolders come from `file.webkitRelativePath` (file picker) or `file.relativePath`
 * (drag-and-drop); both are recreated under UPLOADS.
 *
 * Shows a toast summary. Returns { saved: [{ path, name, size }], failed: [{ name, error }] }.
 *
 * `onSaved(file)` is called as soon as each file has landed, so a caller (the Image
 * Viewer) can start showing the first image while the rest of a big batch is still
 * going in, instead of waiting for the whole upload to finish.
 */
export async function uploadFiles(files, { quiet = false, onSaved } = {}) {
  const saved = [], failed = [];
  if (!files.length) return { saved, failed };
  await vfs.mkdir(UPLOADS_DIR);
  if (!quiet && files.length > 1) toast(`Uploading ${files.length} files…`);

  // ---- 1. Plan everything up front (no disk writes yet) ---------------------
  // Parsing paths and picking collision-free names happens in memory so the
  // writes below never race each other for the same name.
  const plan = files.map((file, index) => {
    const rel = String(file.webkitRelativePath || file.relativePath || '').trim();
    const segments = (rel || file.name)
      .split('/')
      .filter(Boolean)
      .map((s) => s.replace(/[\/\\]/g, '_').trim() || 'file');
    const fileName = segments.pop() || 'file';
    let dir = UPLOADS_DIR;
    for (const seg of segments) dir = joinPath(dir, seg);
    return { file, index, rel, segments, fileName, dir, err: nameError(fileName) };
  });

  // ---- 2. Create every folder, one tree level at a time, each level in parallel
  const dirErrors = new Map();                         // dir path -> Error
  const levels = new Map();                            // depth -> Set<path>
  for (const it of plan) {
    if (it.err) continue;
    let d = UPLOADS_DIR;
    it.segments.forEach((seg, i) => {
      d = joinPath(d, seg);
      if (!levels.has(i)) levels.set(i, new Set());
      levels.get(i).add(d);
    });
  }
  for (const depth of [...levels.keys()].sort((a, b) => a - b)) {
    await Promise.all([...levels.get(depth)].map(async (path) => {
      try { await vfs.mkdir(path); } catch (e) { dirErrors.set(path, e); }
    }));
  }
  const dirFailure = (dir) => {
    // A failed ancestor fails every file beneath it.
    for (const [path, e] of dirErrors) if (dir === path || dir.startsWith(path + '/')) return e;
    return null;
  };

  // ---- 3. Pick unique names: one directory listing per folder, not one lookup per file
  const taken = new Map();                             // dir -> Set<name>
  await Promise.all([...new Set(plan.filter((it) => !it.err && !dirFailure(it.dir)).map((it) => it.dir))]
    .map(async (dir) => {
      let names = [];
      try { names = (await vfs.list(dir)).map((n) => n.name); } catch { /* new dir */ }
      taken.set(dir, new Set(names));
    }));
  for (const it of plan) {
    if (it.err || dirFailure(it.dir)) continue;
    const set = taken.get(it.dir);
    let name = it.fileName;
    if (set.has(name)) {
      const dot = name.lastIndexOf('.');
      const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
      for (let i = 2; set.has(name); i++) name = `${stem} (${i})${ext}`;
    }
    set.add(name);
    it.name = name;
    it.path = joinPath(it.dir, name);
  }

  // ---- 4. Fail fast if the whole batch can't fit (per-file checks would race)
  const todo = plan.filter((it) => it.path);
  try { await vfs.ensureSpace(todo.reduce((n, it) => n + it.file.size, 0)); }
  catch (e) {
    for (const it of plan) failed.push({ name: it.rel || it.file.name, error: e.message.replace(/^E[A-Z]+: /, '') });
    if (!quiet) toast(`Couldn’t upload: ${failed[0].error}`, { danger: true });
    return { saved, failed };
  }

  // ---- 5. Write with a wide worker pool --------------------------------------
  // Files are only references to data on the user's disk (nothing is loaded
  // into memory), so many writes can be in flight at once. Small files are
  // dominated by per-file latency → go very wide. Large files are bound by
  // disk bandwidth → cap how many run at the same time.
  const BIG = 64 * 1024 * 1024, MAX_WIDE = 32, MAX_BIG = 4;
  const results = new Array(plan.length);
  const queue = todo.slice().sort((a, b) => b.file.size - a.file.size);   // biggest first: no long tail
  let bigRunning = 0;

  const runOne = async (it) => {
    try {
      await vfs.write(it.path, it.file, { fresh: true });
      const rec = { path: it.path, name: it.name, size: it.file.size };
      results[it.index] = { ok: rec };
      try { onSaved?.(rec); } catch { /* a listener must never break the upload */ }
    } catch (e) {
      results[it.index] = { err: { name: it.rel || it.file.name, error: e.message.replace(/^E[A-Z]+: /, '') } };
    }
  };

  await vfs.batch(() => new Promise((resolve) => {
    let active = 0, next = 0;
    const pump = () => {
      while (active < MAX_WIDE && next < queue.length) {
        // Find the next runnable job (skip big files while the big-slot cap is full).
        let k = next;
        if (queue[k].file.size >= BIG && bigRunning >= MAX_BIG) {
          k = queue.findIndex((it, i) => i >= next && it.file.size < BIG);
          if (k < 0) break;
        }
        const [it] = queue.splice(k, 1);
        const big = it.file.size >= BIG;
        active++; if (big) bigRunning++;
        runOne(it).finally(() => { active--; if (big) bigRunning--; pump(); });
      }
      if (!active && !queue.length) resolve();
    };
    pump();
  }));

  // Report in the order the user gave the files, not the order they finished.
  for (const it of plan) {
    if (it.err) failed.push({ name: it.rel || it.file.name, error: it.err });
    else if (dirFailure(it.dir)) failed.push({ name: it.rel || it.file.name, error: dirFailure(it.dir).message.replace(/^E[A-Z]+: /, '') });
    else if (results[it.index]?.ok) saved.push(results[it.index].ok);
    else if (results[it.index]?.err) failed.push(results[it.index].err);
  }

  if (!quiet) {
    if (saved.length) {
      const bytes = saved.reduce((n, f) => n + f.size, 0);
      toast(saved.length === 1
        ? `Uploaded “${saved[0].name}” (${formatBytes(bytes)}) to UPLOADS`
        : `Uploaded ${saved.length} files (${formatBytes(bytes)}) to UPLOADS`);
    }
    if (failed.length) {
      toast(`Couldn’t upload ${failed.length === 1 ? `“${failed[0].name}”` : failed.length + ' files'}: ${failed[0].error}`, { danger: true });
    }
  }
  return { saved, failed };
}
