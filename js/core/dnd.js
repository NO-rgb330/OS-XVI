/* Drag-and-drop helpers shared by the desktop, file manager and viewers.
   Two kinds of payload:
     · internal: files dragged out of a Files window  (custom MIME carrying { dir, names })
     · external: files dragged in from the user's computer (DataTransfer files) */

export const PATHS_TYPE = 'application/x-os16-paths';

const typesOf = (e) => Array.from(e.dataTransfer?.types ?? []);
export const hasPaths = (e) => typesOf(e).includes(PATHS_TYPE);
export const hasFiles = (e) => typesOf(e).includes('Files');

export function setDragPaths(e, dir, names) {
  e.dataTransfer.setData(PATHS_TYPE, JSON.stringify({ dir, names }));
  e.dataTransfer.setData('text/plain', names.join('\n'));
  e.dataTransfer.effectAllowed = 'copyMove';
}

/** { dir, names } from an internal drop, or null. Only readable inside a `drop` handler. */
export function readDragPaths(e) {
  try {
    const data = JSON.parse(e.dataTransfer.getData(PATHS_TYPE));
    return Array.isArray(data?.names) && typeof data.dir === 'string' ? data : null;
  } catch { return null; }
}

/** Real files from an external drop. Folders can't be read this way, so they're counted and skipped. */
export function filesFromDrop(e) {
  const files = [];
  let skippedFolders = 0;
  const items = Array.from(e.dataTransfer?.items ?? []);
  if (items.length) {
    for (const it of items) {
      if (it.kind !== 'file') continue;
      if (it.webkitGetAsEntry?.()?.isDirectory) { skippedFolders++; continue; }
      const f = it.getAsFile();
      if (f) files.push(f);
    }
  } else {
    files.push(...Array.from(e.dataTransfer?.files ?? []));
  }
  return { files, skippedFolders };
}
