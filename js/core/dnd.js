/* Drag-and-drop helpers shared by the desktop, file manager and viewers.

   Two kinds of payload:
     · internal: files / app shortcuts dragged out of Files or the desktop
                 (custom MIME carrying { dir, names, appIds })
     · external: files — and now folders — dragged in from the user's computer

   `filesFromDrop` recurses into folders so a dropped folder tree is preserved
   under UPLOADS. Each returned File carries a `relativePath` ('photos/2024/x.jpg')
   which uploadFiles() recreates as real directories.

   Because the DataTransfer API revokes item access after the first await, the
   enumeration of `e.dataTransfer.items` happens synchronously at the top of
   `filesFromDrop` — before any await yields the event loop. */

export const PATHS_TYPE = 'application/x-os16-paths';

const typesOf = (e) => Array.from(e.dataTransfer?.types ?? []);
export const hasPaths = (e) => typesOf(e).includes(PATHS_TYPE);
export const hasFiles = (e) => typesOf(e).includes('Files');

export function setDragPaths(e, dir, names, appIds = {}) {
  e.dataTransfer.setData(PATHS_TYPE, JSON.stringify({ dir, names, appIds }));
  e.dataTransfer.setData('text/plain', names.join('\n'));
  e.dataTransfer.effectAllowed = 'copyMove';
}

/** { dir, names, appIds } from an internal drop, or null. Only readable inside a `drop` handler. */
export function readDragPaths(e) {
  try {
    const data = JSON.parse(e.dataTransfer.getData(PATHS_TYPE));
    if (!Array.isArray(data?.names) || typeof data.dir !== 'string') return null;
    return {
      dir: data.dir,
      names: data.names,
      appIds: (data.appIds && typeof data.appIds === 'object') ? data.appIds : {}
    };
  } catch { return null; }
}

// ---- Folder-aware external drop ----

/** A FileSystemDirectoryReader returns entries in batches; loop until empty. */
function readAllEntries(dirReader) {
  return new Promise((resolve) => {
    const all = [];
    const readMore = () => {
      dirReader.readEntries((batch) => {
        if (!batch.length) return resolve(all);
        all.push(...batch);
        readMore();
      }, () => resolve(all));
    };
    readMore();
  });
}

/**
 * Recursively collect files from a FileSystemEntry (File or Directory).
 * Attaches `relativePath` (path *including* filename, forward-slashed) to each.
 */
async function collectFromEntry(entry, prefix, files) {
  if (entry.isFile) {
    try {
      const file = await new Promise((res, rej) => entry.file(res, rej));
      file.relativePath = prefix ? `${prefix}/${file.name}` : file.name;
      files.push(file);
    } catch { /* read error on a single file: skip it */ }
    return;
  }
  if (entry.isDirectory) {
    let children = [];
    try { children = await readAllEntries(entry.createReader()); }
    catch { /* unreadable folder: skip it */ }
    const nextPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
    for (const child of children) await collectFromEntry(child, nextPrefix, files);
  }
}

/**
 * Real files from an external drop. Folders are recursed; empty folders are
 * preserved by the browser in the entry tree even though their file count is 0
 * — they simply contribute nothing here, and the caller's uploader only
 * recreates the tree for files that exist.
 *
 * `skippedFolders` is retained for API compatibility; with folder support it's
 * 0 unless a folder itself failed to be read by the browser.
 */
export async function filesFromDrop(e) {
  // Synchronous window — must run before any await, or the DataTransfer becomes
  // inaccessible and getAsFile / webkitGetAsEntry will start returning null.
  const items = Array.from(e.dataTransfer?.items ?? []);
  const entries = [];
  const inlineFiles = [];
  for (const it of items) {
    if (it.kind !== 'file') continue;
    const entry = it.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
    else {
      const f = it.getAsFile?.();
      if (f) inlineFiles.push(f);
    }
  }
  const fallbackFiles = items.length ? [] : Array.from(e.dataTransfer?.files ?? []);

  const files = [...inlineFiles, ...fallbackFiles];
  let skippedFolders = 0;

  for (const entry of entries) {
    try { await collectFromEntry(entry, '', files); }
    catch { if (entry.isDirectory) skippedFolders++; }
  }

  return { files, skippedFolders };
}
