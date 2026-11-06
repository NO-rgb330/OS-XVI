import { on, listWindows, getFocused, focusWindow, minimizeWindow } from './wm.js';
import { list as listApps } from './registry.js';
import { iconHTML } from './icons.js';

export function initPanel() {
  const appsBtn = document.getElementById('apps-btn');
  const appsMenu = document.getElementById('apps-menu');
  const appsGrid = document.getElementById('apps-grid');
  const tasklist = document.getElementById('tasklist');
  const clock = document.getElementById('clock');

  // ---- Clock ----
  function tick() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    clock.textContent = `${hh}:${mm}`;
    clock.title = d.toLocaleString();
  }
  tick();
  setInterval(tick, 15000);

  // ---- Apps menu ----
  function renderAppsMenu() {
    appsGrid.replaceChildren();
    for (const app of listApps()) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'app-tile';
      btn.innerHTML = `${iconHTML(app.icon, 22)}<span class="app-name">${app.name}</span>`;
      btn.addEventListener('click', () => {
        closeAppsMenu();
        // dynamic import so we don't force panel to own openWindow
        import('./wm.js').then(({ openWindow }) => openWindow(app.id));
      });
      appsGrid.appendChild(btn);
    }
  }
  function openAppsMenu() {
    renderAppsMenu();
    appsMenu.hidden = false;
    appsBtn.setAttribute('aria-expanded', 'true');
    const r = appsBtn.getBoundingClientRect();
    appsMenu.style.left = r.left + 'px';
    appsMenu.style.top = (r.bottom + 2) + 'px';
    appsMenu.style.minWidth = '340px';
  }
  function closeAppsMenu() {
    appsMenu.hidden = true;
    appsBtn.setAttribute('aria-expanded', 'false');
  }
  appsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (appsMenu.hidden) openAppsMenu(); else closeAppsMenu();
  });
  document.addEventListener('pointerdown', (e) => {
    if (appsMenu.hidden) return;
    if (appsMenu.contains(e.target)) return;
    if (appsBtn.contains(e.target)) return;
    closeAppsMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !appsMenu.hidden) closeAppsMenu();
  });

  // ---- Tasklist ----
  function renderTasklist() {
    const focused = getFocused();
    tasklist.replaceChildren();
    for (const w of listWindows()) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'task-button';
      btn.classList.toggle('active', focused?.id === w.id);
      btn.classList.toggle('minimized', w.state === 'minimized');
      btn.innerHTML = `${iconHTML(w.app.icon, 14)}<span class="task-label">${w.title}</span>`;
      btn.title = w.title;
      btn.addEventListener('click', () => {
        if (w.state === 'minimized' || focused?.id !== w.id) focusWindow(w.id);
        else minimizeWindow(w.id);
      });
      tasklist.appendChild(btn);
    }
  }
  on((ev) => {
    if (ev.type === 'open' || ev.type === 'close' || ev.type === 'focus' || ev.type === 'state') {
      renderTasklist();
    }
  });
  renderTasklist();
}
