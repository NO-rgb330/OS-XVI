import { register } from './core/registry.js';
import { initPanel } from './core/panel.js';
import { openWindow, blurAll } from './core/wm.js';

const APPS = [
  { id: 'files',      name: 'Files',        icon: 'folder',    defaultSize: [820, 540], launch: placeholder },
  { id: 'notepad',    name: 'Notepad',      icon: 'notepad',   defaultSize: [640, 480], launch: placeholder },
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

async function boot() {
  const splash = document.getElementById('splash');
  const status = document.getElementById('splash-status');

  for (const app of APPS) register(app);

  status.textContent = 'Mounting filesystem…';
  // Step 1: await vfs.mount() — stubbed for now.
  await new Promise((r) => setTimeout(r, 250));

  status.textContent = 'Starting shell…';
  initPanel();
  await new Promise((r) => setTimeout(r, 150));

  splash.classList.add('hide');
  setTimeout(() => splash.remove(), 300);

  // Clicking the bare desktop blurs the focused window.
  document.getElementById('desktop').addEventListener('pointerdown', () => blurAll());

  // Expose for devtools tinkering.
  window.__wm = { openWindow };
}

boot().catch((e) => {
  console.error(e);
  const s = document.getElementById('splash-status');
  if (s) s.textContent = 'Boot failed: ' + e.message;
});
