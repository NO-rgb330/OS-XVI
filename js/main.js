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
import { webcraftApp } from './apps/webcraft.js';
import { graphCalcApp } from './apps/graphcalc.js'; // <--- NEW

import { runSetup } from './core/setup.js';
import { runBootSequence } from './core/boot.js';
import { showLogin } from './core/login.js';

const APPS = [
  fileManagerApp,
  notepadApp,
  terminalApp,
  calculatorApp,
  graphCalcApp, // <--- NEW
  imageViewerApp,
  mediaViewerApp,
  serpentApp,
  webcraftApp
];

async function boot() {
  const splash = document.getElementById('splash');
  const isFirstBoot = localStorage.getItem('os16.setup_complete') !== '1';
  
  if (isFirstBoot) {
    splash.remove();
    await runSetup();
  } else {
    splash.classList.add('hide');
    setTimeout(() => splash.remove(), 300);
  }

  await runBootSequence();

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

  await showLogin(false);

  for (const app of APPS) register(app);
  initPanel();
  await initDesktop();

  window.__wm = { openWindow };
}

boot().catch((e) => {
  console.error(e);
});
