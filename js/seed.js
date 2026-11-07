import * as vfs from './core/vfs.js';
import { uniqueName } from './core/files.js';
import { joinPath } from './core/util.js';
import { getPythonDoc, getWebDoc } from './core/docs.js';

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

const MIGRATION_FLAG = 'os16.migrated.v4'; // Bumped to v4

async function migrate() {
  let done = false;
  try { done = localStorage.getItem(MIGRATION_FLAG) === '1'; } catch { /* storage unavailable */ }
  if (done) return;

  console.log('Running seed migration v4 (adding cheat sheets)...');
  
  const pyPath = joinPath(HOME + '/Documents', 'python_cheat_sheet.txt');
  const webPath = joinPath(HOME + '/Documents', 'web_dev_cheat_sheet.txt');
  
  if (!(await vfs.exists(pyPath))) {
    const pyText = await getPythonDoc();
    await vfs.write(pyPath, pyText);
  }
  
  if (!(await vfs.exists(webPath))) {
    const webText = await getWebDoc();
    await vfs.write(webPath, webText);
  }

  try { localStorage.setItem(MIGRATION_FLAG, '1'); } catch { /* ignore */ }
}

export async function seed() {
  if (!(await vfs.exists(HOME))) {
    for (const dir of DIRS) await vfs.mkdir(dir);
    await vfs.write(HOME + '/Documents/welcome.txt', WELCOME);
    
    // Fetch and write cheat sheets for brand new installs
    const pyText = await getPythonDoc();
    const webText = await getWebDoc();
    await vfs.write(HOME + '/Documents/python_cheat_sheet.txt', pyText);
    await vfs.write(HOME + '/Documents/web_dev_cheat_sheet.txt', webText);
    
    try { localStorage.setItem(MIGRATION_FLAG, '1'); } catch { /* ignore */ }
    return;
  }
  
  await vfs.mkdir(HOME + '/UPLOADS');
  await migrate();
}
