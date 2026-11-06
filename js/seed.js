import * as vfs from './core/vfs.js';

export async function seed() {
  if (await vfs.exists('/home/user')) return;

  await vfs.mkdir('/home');
  await vfs.mkdir('/home/user');
  await vfs.mkdir('/home/user/Desktop');
  await vfs.mkdir('/home/user/Documents');
  await vfs.mkdir('/home/user/Pictures');
  await vfs.mkdir('/home/user/Music');
  await vfs.mkdir('/home/user/Videos');
  await vfs.mkdir('/home/user/Downloads');

  const welcome = `Welcome to Monochrome OS.
  
This is a completely client-side operating system running on OPFS.
Everything you do here persists across reloads.

Try opening the Terminal (Step 5) to explore the file system,
or use the File Manager (Step 3) to browse your files.
`;

  await vfs.write('/home/user/Documents/welcome.txt', welcome);
  await vfs.write('/home/user/Desktop/notes.txt', 'Some quick notes...\n');
}
