/* Getting files from the user's computer into the virtual disk.
   Everything uploaded lands in /home/user/UPLOADS. */

import * as vfs from './vfs.js';
import { toast } from './dialogs.js';
import { uniqueName } from './files.js';
import { joinPath, formatBytes, nameError } from './util.js';

export const UPLOADS_DIR = '/home/user/UPLOADS';

/** Open the browser's file chooser. Resolves with the chosen File[] ([] if cancelled). */
export function pickFiles({ accept = '', multiple = true } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = multiple;
    if (accept) input.accept = accept;
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
 * Shows a toast summary. Returns { saved: [{ path, name, size }], failed: [{ name, error }] }.
 */
export async function uploadFiles(files, { quiet = false, skippedFolders = 0 } = {}) {
  const saved = [], failed = [];
  if (!files.length) {
    if (skippedFolders && !quiet) toast('Folders can’t be uploaded — drop individual files instead.', { danger: true });
    return { saved, failed };
  }
  await vfs.mkdir(UPLOADS_DIR);
  if (!quiet && files.length > 1) toast(`Uploading ${files.length} files…`);

  for (const file of files) {
    const clean = file.name.replace(/[\/\\]/g, '_').trim() || 'file';
    try {
      const err = nameError(clean);
      if (err) throw new Error(err);
      const name = await uniqueName(UPLOADS_DIR, clean);
      const path = joinPath(UPLOADS_DIR, name);
      await vfs.write(path, file);
      saved.push({ path, name, size: file.size });
    } catch (e) {
      failed.push({ name: file.name, error: e.message.replace(/^E[A-Z]+: /, '') });
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
    if (skippedFolders) toast('Folders can’t be uploaded — only individual files.', { danger: true });
  }
  return { saved, failed };
}
