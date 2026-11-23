/* Shared file clipboard (Files windows + desktop).
   Holds *references* to files, not their contents: a copy is made (or the file moved) at paste time.
   Cut leaves the originals in place, dimmed, until they are pasted. */

import { transferInto } from './files.js';

let clip = null;               // { mode: 'copy' | 'cut', dir, names }
const subs = new Set();

const notify = () => { for (const cb of subs) { try { cb(clip); } catch (e) { console.error(e); } } };

export const getClipboard = () => clip;
export const onClipboardChange = (cb) => { subs.add(cb); return () => subs.delete(cb); };

/** Is `dir/name` waiting to be moved (so it should be drawn dimmed)? */
export const isCut = (dir, name) => clip?.mode === 'cut' && clip.dir === dir && clip.names.includes(name);

export function setClipboard(mode, dir, names) {
  clip = names.length ? { mode, dir, names: [...names] } : null;
  notify();
}

/**
 * Paste into `dstDir`. Copies get "name (2)" on clashes; cut moves the originals.
 * Returns { done: [{ from, to }], errors: [message] }. A cut clipboard is emptied once pasted;
 * anything that failed to move stays on it so the user can try elsewhere.
 */
export async function paste(dstDir, { beforeEach } = {}) {
  const c = clip;
  if (!c) return { done: [], errors: [] };
  if (c.mode === 'cut' && c.dir === dstDir) {      // moving a file onto its own folder: nothing to do
    setClipboard('cut', c.dir, []);
    return { done: [], errors: [] };
  }
  const res = await transferInto(c.dir, c.names, dstDir, { copy: c.mode === 'copy', beforeEach });
  if (c.mode === 'cut') {
    const moved = new Set(res.done.map((d) => d.from));
    setClipboard('cut', c.dir, c.names.filter((n) => !moved.has(n)));
  }
  return res;
}
