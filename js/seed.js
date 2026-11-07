import * as vfs from './core/vfs.js';
import { uniqueName } from './core/files.js';
import { joinPath } from './core/util.js';

const HOME = '/home/user';
const DIRS = ['/home', HOME, HOME + '/Desktop', HOME + '/Documents', HOME + '/Pictures',
  HOME + '/Music', HOME + '/Videos', HOME + '/Downloads', HOME + '/UPLOADS'];

const WELCOME = `Welcome to Monochrome OS.

This is a completely client-side operating system running on OPFS.
Everything you do here persists across reloads.

Open the Files app to browse your folders, the Calculator for quick maths,
or double-click a text file to edit it in Notepad.

Files you upload from your computer are stored in the UPLOADS folder.
Images open in Image Viewer; audio and video open in Media Viewer.
`;

const LEGACY_NOTES = 'Some quick notes...\n';
const MIGRATION_FLAG = 'os16.migrated.v2';

/** One-time cleanup for installs created by earlier versions. */
async function migrate() {
  let done = false;
  try { done = localStorage.getItem(MIGRATION_FLAG) === '1'; } catch { /* storage unavailable */ }
  if (done) return;

  // The old default Desktop/notes.txt is gone. Untouched copies are deleted;
  // if the user edited it, move it to Documents instead of destroying their text.
  const notes = HOME + '/Desktop/notes.txt';
  if (await vfs.exists(notes)) {
    const text = await (await vfs.read(notes)).text();
    if (text === LEGACY_NOTES) {
      await vfs.rm(notes);
    } else {
      await vfs.mv(notes, joinPath(HOME + '/Documents', await uniqueName(HOME + '/Documents', 'notes.txt')));
    }
  }
  try { localStorage.setItem(MIGRATION_FLAG, '1'); } catch { /* ignore */ }
}

export async function seed() {
  if (!(await vfs.exists(HOME))) {
    for (const dir of DIRS) await vfs.mkdir(dir);
    await vfs.write(HOME + '/Documents/welcome.txt', WELCOME);
    try { localStorage.setItem(MIGRATION_FLAG, '1'); } catch { /* ignore */ }
    return;
  }
  await vfs.mkdir(HOME + '/UPLOADS'); // idempotent: existing installs get the folder too
  await migrate();
}
