import { register } from './core/registry.js';
import { initPanel } from './core/panel.js';
import { openWindow, blurAll } from './core/wm.js';
import * as vfs from './core/vfs.js';
import * as dialogs from './core/dialogs.js';
import { showMenu } from './core/contextmenu.js';
import { iconHTML } from './core/icons.js';
import { esc, joinPath } from './core/util.js';
import { iconFor, openItem, createEntry, renameEntry, deleteEntries } from './core/files.js';
import { seed } from './seed.js';
import { fileManagerApp } from './apps/filemanager.js';
import { notepadApp } from './apps/notepad.js';
import { calculatorApp } from './apps/calculator.js';

const DESKTOP = '/home/user/Desktop';

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
  { id: 'gallery',  name: 'Gallery',      icon: 'gallery',  defaultSize: [800, 560], launch: placeholder },
  { id: 'media',    name: 'Media Player', icon: 'media',    defaultSize: [720, 480], launch: placeholder }
];

// ---------- Desktop icons ----------
let desktopItems = [];
let selectedIcon = null;
let iconRefreshTimer = 0;

async function renderDesktopIcons() {
  const container = document.getElementById('desktop-icons');
  try {
    desktopItems = await vfs.list(DESKTOP);
  } catch (err) {
    console.error('Failed to load desktop icons', err);
    return;
  }
  container.innerHTML = desktopItems.map((item) => `
    <div class="desktop-icon${item.name === selectedIcon ? ' selected' : ''}" role="listitem" tabindex="0" data-name="${esc(item.name)}">
      ${iconHTML(iconFor(item), 48)}
      <div class="desktop-icon-label">${esc(item.name)}</div>
    </div>`).join('');
}

function selectIcon(name) {
  selectedIcon = name;
  for (const el of document.querySelectorAll('.desktop-icon')) {
    el.classList.toggle('selected', el.dataset.name === name);
  }
}

function initDesktop() {
  const desktop = document.getElementById('desktop');
  const container = document.getElementById('desktop-icons');
  const iconOf = (e) => e.target.closest('.desktop-icon');
  const itemOf = (el) => desktopItems.find((i) => i.name === el?.dataset.name);
  const openIcon = (el) => {
    const item = itemOf(el);
    if (item) openItem(joinPath(DESKTOP, item.name), item.kind, item.name);
  };

  container.addEventListener('click', (e) => { const el = iconOf(e); if (el) selectIcon(el.dataset.name); });
  container.addEventListener('dblclick', (e) => { const el = iconOf(e); if (el) openIcon(el); });
  container.addEventListener('keydown', (e) => {
    const el = iconOf(e);
    if (el && e.key === 'Enter') openIcon(el);
  });

  desktop.addEventListener('pointerdown', (e) => {
    blurAll();
    if (!iconOf(e)) selectIcon(null);
  });

  desktop.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const el = iconOf(e);
    if (el) {
      selectIcon(el.dataset.name);
      showMenu(e.clientX, e.clientY, [
        { label: 'Open', action: () => openIcon(el) },
        { label: 'Rename', action: () => renameEntry(DESKTOP, el.dataset.name) },
        { sep: true },
        { label: 'Delete', danger: true, action: () => deleteEntries(DESKTOP, [el.dataset.name]) }
      ]);
    } else {
      showMenu(e.clientX, e.clientY, [
        { label: 'New Folder', action: () => createEntry(DESKTOP, 'dir') },
        { label: 'New Text File', action: () => createEntry(DESKTOP, 'file') }
      ]);
    }
  });

  // Refresh icons when the Desktop folder changes (coalesced).
  vfs.on('change', (path) => {
    if (path !== DESKTOP) return;
    clearTimeout(iconRefreshTimer);
    iconRefreshTimer = setTimeout(renderDesktopIcons, 20);
  });
}

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
  initDesktop();
  await renderDesktopIcons();

  splash.classList.add('hide');
  setTimeout(() => splash.remove(), 300);

  window.__wm = { openWindow };
}

boot().catch((e) => {
  console.error(e);
  const s = document.getElementById('splash-status');
  if (s) s.textContent = 'Boot failed: ' + e.message;
});
