import * as vfs from './core/vfs.js';

const DIRS = ['/home', '/home/user', '/home/user/Desktop', '/home/user/Documents',
  '/home/user/Pictures', '/home/user/Music', '/home/user/Videos', '/home/user/Downloads'];

const WELCOME = `Welcome to Monochrome OS.

This is a completely client-side operating system running on OPFS.
Everything you do here persists across reloads.

Open the Files app to browse your folders, the Calculator for quick maths,
or double-click a text file to edit it in Notepad.
`;

export async function seed() {
  if (await vfs.exists('/home/user')) return;
  for (const dir of DIRS) await vfs.mkdir(dir);
  await vfs.write('/home/user/Documents/welcome.txt', WELCOME);
  await vfs.write('/home/user/Desktop/notes.txt', 'Some quick notes...\n');
}
