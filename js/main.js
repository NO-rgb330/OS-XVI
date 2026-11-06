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

let desktopContextMenu = null;

async function initDesktopIcons() {
  const container = document.getElementById('desktop-icons');
  container.replaceChildren();

  try {
    const items = await vfs.list('/home/user/Desktop');
    
    for (const item of items) {
      const el = document.createElement('div');
      el.className = 'desktop-icon';
      
      const ext = item.name.split('.').pop().toLowerCase();
      let iconType = 'file';
      if (item.kind === 'dir') iconType = 'folder';
      else if (['txt', 'md', 'js', 'json', 'css', 'html'].includes(ext)) iconType = 'file-text';
      
      el.innerHTML = `
        ${iconHTML(iconType, 48)}
        <div class="desktop-icon-label">${item.name}</div>
      `;
      
      el.ondblclick = () => {
        if (item.kind === 'dir') {
          openWindow('files', { path: '/home/user/Desktop/' + item.name });
        } else if (iconType === 'file-text') {
          openWindow('notepad', { path: '/home/user/Desktop/' + item.name });
        } else {
          dialogs.alert('Open File', `Cannot open "${item.name}" yet.`);
        }
      };
      
      el.onclick = (e) => {
        document.querySelectorAll('.desktop-icon').forEach(i => i.classList.remove('selected'));
        el.classList.add('selected');
      };
      
      container.appendChild(el);
    }
  } catch (err) {
    console.error("Failed to load desktop icons", err);
  }
}

function showDesktopContextMenu(x, y) {
  if (desktopContextMenu) desktopContextMenu.remove();
  
  desktopContextMenu = document.createElement('div');
  desktopContextMenu.className = 'fm-ctx-menu'; // Reuse FM style
  
  const items = [
    { label: 'New Folder', action: async () => {
      const name = await dialogs.prompt('New Folder', 'Enter folder name:');
      if (!name) return;
      try {
        await vfs.mkdir('/home/user/Desktop/' + name);
      } catch (e) { dialogs.alert('Error', e.message); }
    }},
    { label: 'New Text File', action: async () => {
      const name = await dialogs.prompt('New Text File', 'Enter file name:', 'untitled.txt');
      if (!name) return;
      try {
        await vfs.write('/home/user/Desktop/' + name, '');
      } catch (e) { dialogs.alert('Error', e.message); }
    }}
  ];
  
  items.forEach(item => {
    const btn = document.createElement('div');
    btn.className = 'fm-ctx-item';
    btn.onclick = () => {
      desktopContextMenu.remove();
      desktopContextMenu = null;
      item.action();
    };
    btn.textContent = item.label;
    desktopContextMenu.appendChild(btn);
  });

  document.body.appendChild(desktopContextMenu);
  
  const rect = desktopContextMenu.getBoundingClientRect();
  if (x + rect.width > window.innerWidth) x -= rect.width;
  if (y + rect.height > window.innerHeight) y -= rect.height;
  desktopContextMenu.style.left = x + 'px';
  desktopContextMenu.style.top = y + 'px';
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
  
  // Listen for changes in the Desktop directory to refresh icons
  vfs.on('change', (path) => {
    if (path === '/home/user/Desktop') initDesktopIcons();
  });

  await new Promise((r) => setTimeout(r, 150));

  splash.classList.add('hide');
  setTimeout(() => splash.remove(), 300);

  // Desktop events
  const desktop = document.getElementById('desktop');
  
  desktop.addEventListener('pointerdown', (e) => {
    blurAll();
    if (e.target.id === 'desktop') {
      document.querySelectorAll('.desktop-icon').forEach(i => i.classList.remove('selected'));
    }
    if (desktopContextMenu && !desktopContextMenu.contains(e.target)) {
      desktopContextMenu.remove(); desktopContextMenu = null;
    }
  });

  desktop.addEventListener('contextmenu', (e) => {
    // Only show custom menu if clicking directly on the wallpaper
    if (e.target.id === 'desktop' || e.target.id === 'desktop-icons') {
      e.preventDefault();
      showDesktopContextMenu(e.clientX, e.clientY);
    }
  });

  window.__wm = { openWindow };
}

boot().catch((e) => {
  console.error(e);
  const s = document.getElementById('splash-status');
  if (s) s.textContent = 'Boot failed: ' + e.message;
});
