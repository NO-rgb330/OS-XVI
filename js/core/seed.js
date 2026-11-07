import * as vfs from './vfs.js';
import { uniqueName } from './files.js';
import { joinPath } from './util.js';
import { PYTHON_DOC, WEB_DOC } from './docs.js';

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
const MIGRATION_FLAG = 'os16.migrated.v3';

async function migrate() {
  let done = false;
  try { done = localStorage.getItem(MIGRATION_FLAG) === '1'; } catch { /* storage unavailable */ }
  if (done) return;

  // Add cheat sheets if they don't exist
  const pyPath = joinPath(HOME + '/Documents', 'python_cheat_sheet.txt');
  const webPath = joinPath(HOME + '/Documents', 'web_dev_cheat_sheet.txt');
  
  if (!(await vfs.exists(pyPath))) await vfs.write(pyPath, PYTHON_DOC.trim());
  if (!(await vfs.exists(webPath))) await vfs.write(webPath, WEB_DOC.trim());

  try { localStorage.setItem(MIGRATION_FLAG, '1'); } catch { /* ignore */ }
}

export async function seed() {
  if (!(await vfs.exists(HOME))) {
    for (const dir of DIRS) await vfs.mkdir(dir);
    await vfs.write(HOME + '/Documents/welcome.txt', WELCOME);
    await vfs.write(HOME + '/Documents/python_cheat_sheet.txt', PYTHON_DOC.trim());
    await vfs.write(HOME + '/Documents/web_dev_cheat_sheet.txt', WEB_DOC.trim());
    try { localStorage.setItem(MIGRATION_FLAG, '1'); } catch { /* ignore */ }
    return;
  }
  await vfs.mkdir(HOME + '/UPLOADS'); // idempotent: existing installs get the folder too
  await migrate();
}
