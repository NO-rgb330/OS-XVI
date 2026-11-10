/* Drag-and-drop helpers shared by the desktop, file manager and viewers.
   Two kinds of payload:
     · internal: files / app shortcuts dragged out of Files or the desktop
                 (custom MIME carrying { dir, names, appIds })
     · external: files dragged in from the user's computer (DataTransfer files)

   `appIds` is a name → appId map. An entry present in this map is an app
   shortcut, not a regular file. The file manager and desktop use it to
   choose the right handling (launch vs open, move vs copy from protected
   SYSTEM APPS, etc.). */

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
