import { register } from './core/registry.js';
import { initPanel } from './core/panel.js';
import { openWindow } from './core/wm.js';
import * as vfs from './core/vfs.js';
import * as dialogs from './core/dialogs.js';
import { initDesktop } from './core/desktop.js';
import { seed } from './seed.js';
import { fileManagerApp } from './apps/filemanager.js';
import { notepadApp } from './apps/notepad.js';
import { calculatorApp } from './apps/calculator.js';
import { imageViewerApp } from './apps/imageviewer.js';
import { mediaViewerApp } from './apps/mediaviewer.js';
import { terminalApp } from './apps/terminal.js';
import { serpentApp } from './apps/serpent.js';

// Import new boot modules
import { runSetup } from './core/setup.js';
import { runBootSequence } from './core/boot.js';
import { showLogin } from './core/login.js';

const APPS = [
  fileManagerApp,
  notepadApp,
  terminalApp,
  calculatorApp,
  imageViewerApp,
  mediaViewerApp,
  serpentApp 
];

async function boot() {
  const splash = document.getElementById('splash');
  
  // 1. Check if first boot
  const isFirstBoot = localStorage.getItem('os16.setup_complete') !== '1';
  
  if (isFirstBoot) {
    splash.remove(); // Remove default splash, we are using setup wizard
    await runSetup();
  } else {
    // If not first boot, keep the splash for a tiny moment then remove it
    // The boot sequence will take over.
    splash.classList.add('hide');
    setTimeout(() => splash.remove(), 300);
  }

  // 2. Run the boot sequence
  await runBootSequence();

  // 3. Mount VFS and Seed
  try {
    await vfs.mount();
    await seed();
  } catch (err) {
    console.error(err);
    document.body.innerHTML = `<div style="color:white;background:black;padding:20px;font-family:monospace;">VFS Mount Failed: ${err.message}</div>`;
    return;
  }
  window.vfs = vfs;
  window.dialogs = dialogs;

  // 4. Show Login Screen
  await showLogin(false);

  // 5. Start the Shell
  for (const app of APPS) register(app);
  initPanel();
  await initDesktop();

  window.__wm = { openWindow };
}

boot().catch((e) => {
  console.error(e);
});
