import { register } from './core/registry.js';
import { initPanel } from './core/panel.js';
import { openWindow, blurAll } from './core/wm.js';
import * as vfs from './core/vfs.js';
import * as dialogs from './core/dialogs.js';
import { seed } from './seed.js';
import { fileManagerApp } from './apps/filemanager.js';
import { notepadApp } from './apps/notepad.js';
import { iconHTML } from './core/icons.js';

const APPS = [
  fileManagerApp,
  notepadApp,
  { id: 'terminal',   name: 'Terminal',     icon: 'terminal',  defaultSize: [720, 440], launch: placeholder },
  { id: 'calculator', name: 'Calculator',   icon: 'calc',      defaultSize: [320, 420], singleton: true, launch: placeholder },
  { id: 'gallery',    name: 'Gallery',      icon: 'gallery',   defaultSize: [800, 560], launch: placeholder },
  { id: 'media',      name: 'Media Player', icon: 'media',     defaultSize: [720, 480], launch: placeholder }
];

function placeholder(body, args, ctx) {
  body.innerHTML = `
    <div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--tx-muted);font-size:13px;background:var(--bg-window)">
      <svg class="icon icon-48" aria-hidden="true"><use href="#i-desktop"/></svg>
      <div>App not implemented yet.</div>
    </div>`;
}

async function initDesktopIcons() {
  const container = document.getElementById('desktop-icons');
  const iconData = [
    { name: 'Files', appId: 'files', icon: 'folder' },
    { name: 'welcome.txt', appId: 'notepad', args: { path: '/home/user/Documents/welcome.txt' }, icon: 'file-text' }
  ];

  container.replaceChildren();
  for (const data of iconData) {
    const el = document.createElement('div');
    el.className = 'desktop-icon';
    el.innerHTML = `
      ${iconHTML(data.icon, 48)}
      <div class="desktop-icon-label">${data.name}</div>
    `;
    
    el.ondblclick = () => {
      if (data.appId) openWindow(data.appId, data.args || {});
    };
    
    el.onclick = (e) => {
      document.querySelectorAll('.desktop-icon').forEach(i => i.classList.remove('selected'));
      el.classList.add('selected');
    };
    
    container.appendChild(el);
  }
}

async function boot() {
  const splash = document.getElementById('splash');
  const status = document.getElementById('splash-status');

  for (const app of APPS) register(app);

  status.textContent = 'Mounting filesystem…';
  try {
    await vfs.mount();
    await seed();
    window.vfs = vfs;
    window.dialogs = dialogs;
  } catch (err) {
    console.error(err);
    status.textContent = 'VFS Mount Failed: ' + err.message;
    return;
  }

  status.textContent = 'Starting shell…';
  initPanel();
  await initDesktopIcons();
  
  await new Promise((r) => setTimeout(r, 150));

  splash.classList.add('hide');
  setTimeout(() => splash.remove(), 300);

  document.getElementById('desktop').addEventListener('pointerdown', (e) => {
    blurAll();
    if (e.target.id === 'desktop') {
      document.querySelectorAll('.desktop-icon').forEach(i => i.classList.remove('selected'));
    }
  });

  window.__wm = { openWindow };
}

boot().catch((e) => {
  console.error(e);
  const s = document.getElementById('splash-status');
  if (s) s.textContent = 'Boot failed: ' + e.message;
});
