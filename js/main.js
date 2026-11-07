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

function placeholder(body) {
  body.innerHTML = `
    <div class="app-empty" style="background:var(--bg-window)">
      <svg class="icon icon-48" aria-hidden="true"><use href="#i-desktop"/></svg>
      <div>App not implemented yet.</div>
    </div>`;
}

const APPS = [
  fileManagerApp,
  notepadApp,
  { id: 'terminal', name: 'Terminal',     icon: 'terminal', defaultSize: [720, 440], launch: placeholder },
  calculatorApp,
  imageViewerApp,
  mediaViewerApp
];

// ---------- Boot ----------
async function boot() {
  const splash = document.getElementById('splash');
  const status = document.getElementById('splash-status');

  for (const app of APPS) register(app);

  status.textContent = 'Mounting filesystem…';
  try {
    await vfs.mount();
    await seed();
  } catch (err) {
    console.error(err);
    status.textContent = 'VFS Mount Failed: ' + err.message;
    return;
  }
  window.vfs = vfs;
  window.dialogs = dialogs;

  status.textContent = 'Starting shell…';
  initPanel();
  await initDesktop();

  splash.classList.add('hide');
  setTimeout(() => splash.remove(), 300);

  window.__wm = { openWindow };
}

boot().catch((e) => {
  console.error(e);
  const s = document.getElementById('splash-status');
  if (s) s.textContent = 'Boot failed: ' + e.message;
});
