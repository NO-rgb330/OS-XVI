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
import { graphCalcApp } from './apps/graphcalc.js';
import { codeScanApp } from './apps/codescan.js';
import { clockApp } from './apps/clock.js';
import { sysMonApp } from './apps/sysmon.js'; 
import { archiverApp } from './apps/archiver.js';
import { wikipediaApp } from './apps/wikipedia.js';

import { runSetup } from './core/setup.js';
import { runBootSequence } from './core/boot.js';
import { showLogin } from './core/login.js';

const APPS = [
  fileManagerApp,
  notepadApp,
  terminalApp,
  calculatorApp,
  graphCalcApp,
  clockApp,
  codeScanApp,
  sysMonApp, // <--- NEW
  imageViewerApp,
  mediaViewerApp,
  serpentApp,
  webcraftApp,
  archiverApp,
  wikipediaApp
];

async function boot() {
  const splash = document.getElementById('splash');

  const hideSplash = () => {
    if (!splash) return;
    splash.classList.add('hide');
    setTimeout(() => splash.remove(), 300);
  };

  const showBootError = (title, message, error) => {
    const fallback = document.createElement('div');
    fallback.style.cssText = `
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      background: #000;
      color: #fff;
      font-family: monospace;
      padding: 24px;
      z-index: 99999;
    `;

    fallback.innerHTML = `
      <div style="max-width: 700px; border: 1px solid #444; padding: 24px; background: #111;">
        <h2 style="margin:0 0 12px 0;">${title}</h2>
        <p style="margin:0 0 12px 0; color:#ff8888;">${message}</p>
        <pre style="white-space: pre-wrap; color:#ddd; margin:0;">${error ? String(error).slice(0, 1000) : ''}</pre>
      </div>
    `;

    document.body.innerHTML = '';
    document.body.appendChild(fallback);
  };

  const isFirstBoot = localStorage.getItem('os16.setup_complete') !== '1';

  try {
    if (isFirstBoot) {
      if (splash) splash.remove();
      await runSetup();
    } else {
      hideSplash();
    }

    await runBootSequence();

    try {
      await vfs.mount();
      await seed();
    } catch (err) {
      console.error(err);
      showBootError('VFS Mount Failed', 'The virtual filesystem could not initialize.', err);
      return;
    }

    window.vfs = vfs;
    window.dialogs = dialogs;

    await showLogin(false);

    for (const app of APPS) register(app);
    initPanel();
    await initDesktop();

    window.__wm = { openWindow };
  } catch (err) {
    console.error(err);
    showBootError('System Boot Failed', 'The operating system did not finish booting.', err);
  }
}

boot().catch((e) => {
  console.error(e);
  const splash = document.getElementById('splash');
  if (splash) splash.remove();

  const fallback = document.createElement('div');
  fallback.style.cssText = `
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    background: #000;
    color: #fff;
    font-family: monospace;
    padding: 24px;
  `;
  fallback.textContent = 'Boot Error: ' + (e?.message || e);
  document.body.innerHTML = '';
  document.body.appendChild(fallback);
});
