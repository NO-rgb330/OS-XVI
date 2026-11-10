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
import { uniqueName } from './files.js';
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
 */
export async function uploadFiles(files, { quiet = false } = {}) {
  const saved = [], failed = [];
  if (!files.length) return { saved, failed };
  await vfs.mkdir(UPLOADS_DIR);
  if (!quiet && files.length > 1) toast(`Uploading ${files.length} files…`);

  // Cache of folders already created this session — a folder upload creates the
  // same parent directory for every file inside it.
  const dirsMade = new Set([UPLOADS_DIR]);
  const ensureDir = async (path) => {
    if (dirsMade.has(path)) return;
    await vfs.mkdir(path);
    dirsMade.add(path);
  };

  for (const file of files) {
    const rel = String(file.webkitRelativePath || file.relativePath || '').trim();
    const segments = (rel || file.name)
      .split('/')
      .filter(Boolean)
      .map((s) => s.replace(/[\/\\]/g, '_').trim() || 'file');
    const fileName = segments.pop() || 'file';

    try {
      const err = nameError(fileName);
      if (err) throw new Error(err);

      let targetDir = UPLOADS_DIR;
      for (const seg of segments) {
        targetDir = joinPath(targetDir, seg);
        await ensureDir(targetDir);
      }

      const name = await uniqueName(targetDir, fileName);
      const path = joinPath(targetDir, name);
      await vfs.write(path, file);
      saved.push({ path, name, size: file.size });
    } catch (e) {
      failed.push({ name: rel || file.name, error: e.message.replace(/^E[A-Z]+: /, '') });
    }
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
