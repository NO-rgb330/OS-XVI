import { on, listWindows, getFocused, focusWindow, minimizeWindow, openWindow, goHome } from './wm.js';
import { list as listApps } from './registry.js';
import { iconHTML } from './icons.js';
import { esc } from './util.js';
import { showMenu } from './contextmenu.js';
import { hasAppIcon, addAppIcon, removeAppIcon } from './desktop.js';
import { showLogin } from './login.js';
import { initBattery } from './battery.js';

export function initPanel() {
  const appsBtn = document.getElementById('apps-btn');
  const appsMenu = document.getElementById('apps-menu');
  const appsGrid = document.getElementById('apps-grid');
  const tasklist = document.getElementById('tasklist');
  const clock = document.getElementById('clock');
  const sessionBtn = document.getElementById('session-btn');

  // ---- Lock Screen ----
  if (sessionBtn) {
    sessionBtn.addEventListener('click', () => {
      showLogin(true);
    });
  }

  // ---- Home button (phones only; hidden by CSS elsewhere) ----
  const homeBtn = document.createElement('button');
  homeBtn.id = 'home-btn'; homeBtn.type = 'button'; homeBtn.className = 'panel-btn panel-btn-icon';
  homeBtn.title = 'Home'; homeBtn.setAttribute('aria-label', 'Home');
  homeBtn.innerHTML = iconHTML('home', 20);
  homeBtn.addEventListener('click', goHome);
  tasklist.before(homeBtn);

  // ---- Clock (aligned to the minute boundary) ----
  function tick() {
    const d = new Date();
    clock.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    clock.title = d.toLocaleString();
    setTimeout(tick, 60000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 50);
  }
  tick();

  initBattery();

  // ---- Apps menu ----
  appsGrid.innerHTML = listApps().map((app) => `
    <button type="button" class="app-tile" role="menuitem" data-app="${esc(app.id)}">
      ${iconHTML(app.icon, 22)}<span class="app-name">${esc(app.name)}</span>
    </button>`).join('');
  appsGrid.addEventListener('click', (e) => {
    const tile = e.target.closest('[data-app]');
    if (!tile) return;
    closeAppsMenu();
    openWindow(tile.dataset.app);
  });

  appsGrid.addEventListener('contextmenu', (e) => {
    const tile = e.target.closest('[data-app]');
    if (!tile) return;
    e.preventDefault();
    const id = tile.dataset.app;
    showMenu(e.clientX, e.clientY, [
      { label: 'Open', action: () => { closeAppsMenu(); openWindow(id); } },
      hasAppIcon(id)
        ? { label: 'Remove from Desktop', action: () => removeAppIcon(id) }
        : { label: 'Add to Desktop', action: () => addAppIcon(id) }
    ]);
  });

  function openAppsMenu() {
    appsMenu.hidden = false;
    appsBtn.setAttribute('aria-expanded', 'true');
    const r = appsBtn.getBoundingClientRect();
    // Panel is at the bottom: open upwards.
    appsMenu.style.left = r.left + 'px';
    appsMenu.style.bottom = (window.innerHeight - r.top + 2) + 'px';
    appsMenu.style.top = 'auto';
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
    if (!appsMenu.hidden && !appsMenu.contains(e.target) && !appsBtn.contains(e.target)) closeAppsMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !appsMenu.hidden) closeAppsMenu();
  });

  // ---- Tasklist ----
  function renderTasklist() {
    const focused = getFocused();
    tasklist.replaceChildren(...listWindows().map((w) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'task-button';
      btn.classList.toggle('active', focused?.id === w.id);
      btn.classList.toggle('minimized', w.state === 'minimized');
      btn.innerHTML = `${iconHTML(w.app.icon, 14)}<span class="task-label"></span>`;
      btn.querySelector('.task-label').textContent = w.title;
      btn.title = w.title;
      btn.addEventListener('click', () => {
        if (w.state === 'minimized' || focused?.id !== w.id) focusWindow(w.id);
        else minimizeWindow(w.id);
      });
      return btn;
    }));
  }
  on(renderTasklist);
  renderTasklist();
}
