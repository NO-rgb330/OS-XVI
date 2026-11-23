import { get as getApp } from './registry.js';
import { isMobile, onMobileChange } from './mobile.js';

const MIN_W = 280;
const MIN_H = 160;

let nextZ = 0;
let nextId = 0;
let focusedId = null;
let panelH = null;
const windows = new Map();
const listeners = new Set();

let flyout = null;
let hideTimer = null;

// Remember the most recent pointer press so a window opened from a click
// can grow out of the spot the user actually touched. Programmatic opens
// fall back to the window's centre.
let lastPointer = { x: 0, y: 0, t: 0 };
document.addEventListener('pointerdown', (e) => {
  lastPointer = { x: e.clientX, y: e.clientY, t: Date.now() };
}, true);

const getPanelH = () =>
  parseInt(getComputedStyle(document.documentElement).getPropertyValue('--panel-h'), 10) || 30;

function emit(event) { for (const fn of listeners) fn(event); }
export function on(cb) { listeners.add(cb); return () => listeners.delete(cb); }
export function listWindows() { return [...windows.values()]; }
export function getFocused() { return focusedId ? windows.get(focusedId) : null; }

function topVisible() {
  let best = null;
  for (const w of windows.values()) if (w.state !== 'minimized' && (!best || w.z > best.z)) best = w;
  return best;
}

// ---- Snap Layout Definitions ----
const SNAP_LAYOUTS = [
  { w: 2, h: 1, zones: [ { x: 0, y: 0, w: 1, h: 1 }, { x: 1, y: 0, w: 1, h: 1 } ] },
  { w: 2, h: 2, zones: [ { x: 0, y: 0, w: 1, h: 2 }, { x: 1, y: 0, w: 1, h: 1 }, { x: 1, y: 1, w: 1, h: 1 } ] },
  { w: 2, h: 2, zones: [ { x: 0, y: 0, w: 1, h: 1 }, { x: 0, y: 1, w: 1, h: 1 }, { x: 1, y: 0, w: 1, h: 2 } ] },
  { w: 2, h: 2, zones: [ { x: 0, y: 0, w: 1, h: 1 }, { x: 1, y: 0, w: 1, h: 1 }, { x: 0, y: 1, w: 1, h: 1 }, { x: 1, y: 1, w: 1, h: 1 } ] },
  { w: 3, h: 1, zones: [ { x: 0, y: 0, w: 1, h: 1 }, { x: 1, y: 0, w: 1, h: 1 }, { x: 2, y: 0, w: 1, h: 1 } ] },
  { w: 2, h: 2, zones: [ { x: 0, y: 0, w: 2, h: 1 }, { x: 0, y: 1, w: 1, h: 1 }, { x: 1, y: 1, w: 1, h: 1 } ] }
];

// ---- Flyout Logic ----
function getFlyout() {
  if (!flyout) {
    flyout = document.createElement('div');
    flyout.id = 'snap-flyout';
    document.body.appendChild(flyout);

    flyout.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    flyout.addEventListener('mouseleave', () => { hideTimer = setTimeout(hideFlyout, 200); });
  }
  return flyout;
}

function hideFlyout() {
  if (flyout) flyout.classList.remove('show');
}

function showFlyout(rec, anchorEl) {
  clearTimeout(hideTimer);
  const f = getFlyout();
  f.innerHTML = '';

  SNAP_LAYOUTS.forEach(layoutData => {
    const el = document.createElement('div');
    el.className = 'snap-layout';
    el.style.gridTemplateColumns = `repeat(${layoutData.w}, 1fr)`;
    el.style.gridTemplateRows = `repeat(${layoutData.h}, 1fr)`;

    layoutData.zones.forEach(zone => {
      const z = document.createElement('div');
      z.className = 'snap-zone';
      z.style.gridColumn = `${zone.x + 1} / span ${zone.w}`;
      z.style.gridRow = `${zone.y + 1} / span ${zone.h}`;
      z.onclick = (e) => {
        e.stopPropagation();
        applySnap(rec, layoutData, zone);
        hideFlyout();
      };
      el.appendChild(z);
    });
    f.appendChild(el);
  });

  const rect = anchorEl.getBoundingClientRect();
  f.style.top = (rect.bottom + 6) + 'px';

  let left = rect.left + rect.width / 2 - (f.offsetWidth || 260) / 2;
  if (left < 10) left = 10;
  if (left + (f.offsetWidth || 260) > window.innerWidth - 10) left = window.innerWidth - (f.offsetWidth || 260) - 10;

  f.style.left = left + 'px';
  f.classList.add('show');
}

function applySnap(rec, layout, zone) {
  if (rec.state !== 'snapped' && rec.state !== 'maximized') {
    rec.preSnapRect = { ...rec.rect };
  }

  const availH = window.innerHeight - getPanelH();
  const w = window.innerWidth;

  const rx = w / layout.w;
  const ry = availH / layout.h;

  rec.rect = {
    x: Math.round(zone.x * rx),
    y: Math.round(zone.y * ry),
    w: Math.round(zone.w * rx),
    h: Math.round(zone.h * ry)
  };

  rec.state = 'snapped';
  rec.el.classList.remove('maximized');
  applyRect(rec);

  const btn = rec.el.querySelector('.window-btn-max');
  const icon = btn.querySelector('use');
  icon.setAttribute('href', '#i-restore');
  btn.title = 'Restore';

  emit({ type: 'state', id: rec.id });
}

// ---- Open / close animation helpers ----
function startOpenAnimation(rec) {
  const now = Date.now();
  const origin = (now - lastPointer.t < 600)
    ? lastPointer
    : { x: rec.rect.x + rec.rect.w / 2, y: rec.rect.y + rec.rect.h / 2 };
  const ox = Math.max(0, Math.min(rec.rect.w, origin.x - rec.rect.x));
  const oy = Math.max(0, Math.min(rec.rect.h, origin.y - rec.rect.y));
  rec.el.style.setProperty('--window-origin', `${ox}px ${oy}px`);
  rec.el.classList.add('opening');
  void rec.el.offsetWidth;     // force layout so the animation reliably starts
  const onEnd = (e) => {
    if (e.target !== rec.el) return;   // ignore animationend bubbled from descendants
    rec.el.removeEventListener('animationend', onEnd);
    rec.el.classList.remove('opening');
  };
  rec.el.addEventListener('animationend', onEnd);
}

function playCloseAnimation(rec) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (e) => {
      if (e && e.target !== rec.el) return;
      if (done) return;
      done = true;
      rec.el.removeEventListener('animationend', finish);
      resolve();
    };
    rec.el.classList.add('closing');
    rec.el.addEventListener('animationend', finish);
    setTimeout(finish, 400);   // fallback if animationend never fires
  });
}

// ---- Core Window Logic ----
export function openWindow(appId, args = {}) {
  const app = getApp(appId);
  if (!app) return null;
  if (app.singleton) {
    for (const w of windows.values()) {
      if (w.app.id === appId) { focusWindow(w.id); return w; }
    }
  }

  const availH = window.innerHeight - getPanelH();
  const [dw, dh] = args.size || app.defaultSize || [640, 480];
  const w = Math.min(dw, Math.max(MIN_W, window.innerWidth - 32));
  const h = Math.min(dh, Math.max(MIN_H, availH - 32));
  const offset = (windows.size % 8) * 24;

  const rec = {
    id: 'w' + (++nextId),
    app, args, state: 'normal', title: app.name,
    rect: {
      x: Math.max(16, Math.round((window.innerWidth - w) / 2) + offset),
      y: Math.max(16, Math.round((availH - h) / 2) + offset),
      w, h
    },
    preSnapRect: null,
    z: ++nextZ, el: null, bodyEl: null,
    cleanups: [], beforeClose: null, onFocus: null, closed: false, closing: false
  };
  rec.el = buildWindowEl(rec);
  document.getElementById('window-layer').appendChild(rec.el);
  applyRect(rec);
  startOpenAnimation(rec);

  windows.set(rec.id, rec);
  focusWindow(rec.id);
  emit({ type: 'open', id: rec.id });

  const addCleanup = (fn) => {
    if (typeof fn !== 'function') return;
    if (rec.closed) { try { fn(); } catch (e) { console.error(e); } } else rec.cleanups.push(fn);
  };
  const ctx = {
    close: () => closeWindow(rec.id),
    setTitle: (t) => setTitle(rec.id, t),
    onCleanup: addCleanup,
    onBeforeClose: (fn) => { rec.beforeClose = fn; },
    onFocus: (fn) => { rec.onFocus = fn; },
    rect: () => ({ ...rec.rect })
  };

  const fail = (e) => {
    console.error(e);
    rec.bodyEl.textContent = `${app.name} failed to start: ${e.message}`;
    rec.bodyEl.style.padding = '16px';
  };
  try {
    Promise.resolve(app.launch?.(rec.bodyEl, args, ctx)).then(addCleanup).catch(fail);
  } catch (e) { fail(e); }
  return rec;
}

function buildWindowEl(rec) {
  const el = document.createElement('div');
  el.className = 'window';
  el.dataset.id = rec.id;
  el.innerHTML = `
    <div class="window-titlebar">
      <svg class="icon window-icon" aria-hidden="true"><use href="#i-${rec.app.icon}"/></svg>
      <div class="window-title"></div>
      <div class="window-buttons">
        <button class="window-btn window-btn-min" title="Minimize"><svg class="icon" aria-hidden="true"><use href="#i-min"/></svg></button>
        <button class="window-btn window-btn-max" title="Maximize"><svg class="icon" aria-hidden="true"><use href="#i-max"/></svg></button>
        <button class="window-btn window-btn-close" title="Close"><svg class="icon" aria-hidden="true"><use href="#i-close"/></svg></button>
      </div>
    </div>
    <div class="window-body"></div>
    ${['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'].map((d) =>
      `<div class="window-resize window-resize-${d}" data-dir="${d}"></div>`).join('')}
  `;

  el.querySelector('.window-title').textContent = rec.title;
  rec.bodyEl = el.querySelector('.window-body');

  const minBtn = el.querySelector('.window-btn-min');
  const maxBtn = el.querySelector('.window-btn-max');
  const closeBtn = el.querySelector('.window-btn-close');

  minBtn.addEventListener('click', (e) => { e.stopPropagation(); minimizeWindow(rec.id); });
  closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeWindow(rec.id); });

  maxBtn.addEventListener('mouseenter', () => {
    if (!isMobile() && rec.state !== 'maximized') showFlyout(rec, maxBtn);
  });
  maxBtn.addEventListener('mouseleave', () => {
    hideTimer = setTimeout(hideFlyout, 200);
  });
  maxBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    hideFlyout();
    toggleMaximize(rec.id);
  });

  el.addEventListener('pointerdown', () => focusWindow(rec.id), true);
  const tb = el.querySelector('.window-titlebar');
  tb.addEventListener('pointerdown', (e) => startDrag(e, rec, tb));
  tb.addEventListener('dblclick', (e) => { if (!isMobile() && !e.target.closest('.window-btn')) toggleMaximize(rec.id); });

  el.querySelectorAll('.window-resize').forEach((h) => {
    h.addEventListener('pointerdown', (e) => startResize(e, rec, h));
  });
  return el;
}

function applyRect(rec) {
  const { x, y, w, h } = rec.rect;
  const s = rec.el.style;
  s.left = x + 'px';
  s.top = y + 'px';
  s.width = w + 'px';
  s.height = h + 'px';
}

function trackPointer(e, target, cls, rec, move, endCb) {
  target.setPointerCapture(e.pointerId);
  rec.el.classList.add(cls);
  const onMove = (ev) => move(ev);
  const end = (ev) => {
    rec.el.classList.remove(cls);
    target.removeEventListener('pointermove', onMove);
    target.removeEventListener('pointerup', end);
    target.removeEventListener('pointercancel', end);
    if (endCb) endCb(ev);
  };
  target.addEventListener('pointermove', onMove);
  target.addEventListener('pointerup', end);
  target.addEventListener('pointercancel', end);
}

function startDrag(e, rec, tb) {
  if (isMobile() || e.button !== 0 || rec.state === 'maximized' || e.target.closest('.window-btn')) return;

  if (rec.state === 'snapped' && rec.preSnapRect) {
    rec.state = 'normal';
    rec.rect = { ...rec.preSnapRect };
    rec.preSnapRect = null;
    applyRect(rec);

    rec.rect.x = e.clientX - rec.rect.w / 2;
    rec.rect.y = Math.max(0, e.clientY - 15);
    rec.el.style.left = rec.rect.x + 'px';
    rec.el.style.top = rec.rect.y + 'px';

    const maxBtn = rec.el.querySelector('.window-btn-max');
    const icon = maxBtn.querySelector('use');
    icon.setAttribute('href', '#i-max');
    maxBtn.title = 'Maximize';
  }

  const startX = e.clientX, startY = e.clientY;
  const x0 = rec.rect.x, y0 = rec.rect.y;
  const maxY = window.innerHeight - getPanelH() - 40;

  trackPointer(e, tb, 'dragging', rec, (ev) => {
    rec.rect.x = Math.max(-rec.rect.w + 80, Math.min(window.innerWidth - 80, x0 + ev.clientX - startX));
    rec.rect.y = Math.max(0, Math.min(maxY, y0 + ev.clientY - startY));
    rec.el.style.left = rec.rect.x + 'px';
    rec.el.style.top = rec.rect.y + 'px';
  });
}

function startResize(e, rec, handle) {
  if (isMobile() || e.button !== 0 || rec.state === 'maximized') return;
  e.stopPropagation();
  const dir = handle.dataset.dir;
  const startX = e.clientX, startY = e.clientY;
  const { x, y, w, h } = rec.rect;

  trackPointer(e, handle, 'resizing', rec, (ev) => {
    const dx = ev.clientX - startX, dy = ev.clientY - startY;
    let nx = x, ny = y, nw = w, nh = h;
    if (dir.includes('e')) nw = Math.max(MIN_W, w + dx);
    if (dir.includes('s')) nh = Math.max(MIN_H, h + dy);
    if (dir.includes('w')) { nw = Math.max(MIN_W, w - dx); nx = x + (w - nw); }
    if (dir.includes('n')) { nh = Math.max(MIN_H, h - dy); ny = y + (h - nh); }
    rec.rect = { x: nx, y: ny, w: nw, h: nh };
    applyRect(rec);
  }, () => {
    if (rec.state === 'snapped') {
      rec.state = 'normal';
      rec.preSnapRect = null;
      const maxBtn = rec.el.querySelector('.window-btn-max');
      const icon = maxBtn.querySelector('use');
      icon.setAttribute('href', '#i-max');
      maxBtn.title = 'Maximize';
    }
  });
}

export function focusWindow(id) {
  const rec = windows.get(id);
  if (!rec) return;
  if (rec.state === 'minimized') {
    rec.state = 'normal';
    rec.el.classList.remove('minimized');
  }
  if (focusedId === id) return;
  if (focusedId) windows.get(focusedId)?.el.classList.remove('focused');
  focusedId = id;
  rec.z = ++nextZ;
  rec.el.style.zIndex = rec.z;
  rec.el.classList.add('focused');
  emit({ type: 'focus', id });
  try { rec.onFocus?.(); } catch (e) { console.error(e); }
}

/** Pull every window back inside the screen (used when the screen size class changes). */
export function fitWindows() {
  const availH = window.innerHeight - getPanelH();
  for (const rec of windows.values()) {
    if (rec.state === 'maximized') continue;
    const w = Math.min(rec.rect.w, window.innerWidth), h = Math.min(rec.rect.h, availH);
    rec.rect = { w, h, x: Math.max(0, Math.min(rec.rect.x, window.innerWidth - w)), y: Math.max(0, Math.min(rec.rect.y, availH - h)) };
    if (rec.state === 'snapped') { rec.state = 'normal'; rec.preSnapRect = null; }
    applyRect(rec);
  }
}
onMobileChange((m) => { if (!m) fitWindows(); });

/** Phone "home": hide every window and show the desktop. */
export function goHome() { blurAll(); }

export function blurAll() {
  if (!focusedId) return;
  windows.get(focusedId)?.el.classList.remove('focused');
  focusedId = null;
  emit({ type: 'focus', id: null });
}

export function minimizeWindow(id) {
  const rec = windows.get(id);
  if (!rec) return;
  rec.state = 'minimized';
  rec.el.classList.add('minimized');
  if (focusedId === id) {
    rec.el.classList.remove('focused');
    focusedId = null;
    const best = isMobile() ? null : topVisible();        // on a phone, minimising goes back to the home screen
    if (best) focusWindow(best.id);
    else emit({ type: 'focus', id: null });
  }
  emit({ type: 'state', id });
}

function toggleMaximize(id) {
  const rec = windows.get(id);
  if (!rec) return;
  const btn = rec.el.querySelector('.window-btn-max');
  const icon = btn.querySelector('use');

  if (rec.state === 'maximized' || rec.state === 'snapped') {
    rec.state = 'normal';
    rec.el.classList.remove('maximized');
    if (rec.preSnapRect) {
      rec.rect = { ...rec.preSnapRect };
      rec.preSnapRect = null;
    }
    icon.setAttribute('href', '#i-max');
    btn.title = 'Maximize';
    applyRect(rec);
  } else {
    rec.el.classList.remove('minimized');
    rec.preSnapRect = { ...rec.rect };
    rec.state = 'maximized';
    rec.el.classList.add('maximized');
    icon.setAttribute('href', '#i-restore');
    btn.title = 'Restore';
  }
  emit({ type: 'state', id });
}

export async function closeWindow(id, force = false) {
  const rec = windows.get(id);
  if (!rec || rec.closing) return false;

  // Block a second close attempt while we're still awaiting beforeClose
  // or playing the exit animation.
  rec.closing = true;

  if (!force && rec.beforeClose) {
    let ok = true;
    try { ok = (await rec.beforeClose()) !== false; } catch (e) { console.error(e); }
    if (!ok) { rec.closing = false; focusWindow(id); return false; }
    if (!windows.has(id)) return true;
  }

  await playCloseAnimation(rec);

  rec.closed = true;
  for (const fn of rec.cleanups) { try { fn(); } catch (e) { console.error(e); } }
  rec.el.remove();
  windows.delete(id);
  if (focusedId === id) {
    focusedId = null;
    const best = topVisible();
    if (best) focusWindow(best.id);
  }
  emit({ type: 'close', id });
  return true;
}

export function setTitle(id, title) {
  const rec = windows.get(id);
  if (!rec) return;
  rec.title = title;
  rec.el.querySelector('.window-title').textContent = title;
  emit({ type: 'state', id });
}
