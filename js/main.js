import './core/mobile.js';
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
import { localAiApp } from './apps/localai.js';
import { youtubeApp } from './apps/youtube.js';

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
  sysMonApp,
  imageViewerApp,
  mediaViewerApp,
  serpentApp,
  webcraftApp,
  archiverApp,
  wikipediaApp,
  localAiApp,
  youtubeApp
];

/** Catastrophic-only fallback. Boot-sequence failures are handled inside boot.js. */
function showFatalError(title, message, error) {
  const el = document.createElement('div');
  el.style.cssText = `
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
  el.innerHTML = `
    <div style="max-width: 700px; border: 1px solid #444; padding: 24px; background: #111;">
      <h2 style="margin:0 0 12px 0;">${title}</h2>
      <p style="margin:0 0 12px 0; color:#ff8888;">${message}</p>
      <pre style="white-space: pre-wrap; color:#ddd; margin:0;">${error ? String(error).slice(0, 1000) : ''}</pre>
    </div>
  `;
  document.body.innerHTML = '';
  document.body.appendChild(el);
}

async function boot() {
  const splash = document.getElementById('splash');
  const hideSplash = () => {
    if (!splash) return;
    splash.classList.add('hide');
    setTimeout(() => splash.remove(), 300);
  };

  const isFirstBoot = localStorage.getItem('os16.setup_complete') !== '1';

  try {
    if (isFirstBoot) {
      if (splash) splash.remove();
      await runSetup();
    } else {
      hideSplash();
    }
  } catch (err) {
    console.error(err);
    if (splash) splash.remove();
    showFatalError('Setup Failed', 'The setup wizard did not complete.', err);
    return;
  }

  try {
    // Everything the shell needs to run — checked, mounted, seeded, wired up
    // and shell-initialised — happens here. Resolves only when the desktop is
    // ready to be shown behind the login screen.
    const { code } = await runBootSequence({
      vfs, seed, apps: APPS, register, initPanel, initDesktop
    });
    // code is OK or DISK_FULL (continue path). FAILURE/HANG never resolve.

    window.vfs = vfs;
    window.dialogs = dialogs;

    await showLogin(false);

    window.__wm = { openWindow };
    console.info(`[boot] login complete (boot code ${code})`);
  } catch (err) {
    console.error(err);
    showFatalError('System Boot Failed', 'The operating system did not finish booting.', err);
  }
}

boot().catch((e) => {
  console.error(e);
  const splash = document.getElementById('splash');
  if (splash) splash.remove();
  showFatalError('Boot Error', 'Something went wrong before the boot sequence could start.', e);
});
