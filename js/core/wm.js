import { get as getApp } from './registry.js';

const MIN_W = 280;
const MIN_H = 160;

let nextZ = 0;
let nextId = 0;
let focusedId = null;
let panelH = null;
const windows = new Map();
const listeners = new Set();

const getPanelH = () =>
  (panelH ??= parseInt(getComputedStyle(document.documentElement).getPropertyValue('--panel-h'), 10) || 30);

function emit(event) { for (const fn of listeners) fn(event); }
export function on(cb) { listeners.add(cb); return () => listeners.delete(cb); }
export function listWindows() { return [...windows.values()]; }
export function getFocused() { return focusedId ? windows.get(focusedId) : null; }

function topVisible() {
  let best = null;
  for (const w of windows.values()) if (w.state !== 'minimized' && (!best || w.z > best.z)) best = w;
  return best;
}

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
    z: ++nextZ, el: null, bodyEl: null,
    cleanups: [], beforeClose: null, onFocus: null, closed: false, closing: false
  };
  rec.el = buildWindowEl(rec);
  document.getElementById('window-layer').appendChild(rec.el);
  applyRect(rec);
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
    /** fn() may return false (or a Promise of false) to veto closing. */
    onBeforeClose: (fn) => { rec.beforeClose = fn; },
    /** Called whenever the window receives focus. */
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
  el.querySelector('.window-btn-min').addEventListener('click', (e) => { e.stopPropagation(); minimizeWindow(rec.id); });
  el.querySelector('.window-btn-max').addEventListener('click', (e) => { e.stopPropagation(); toggleMaximize(rec.id); });
  el.querySelector('.window-btn-close').addEventListener('click', (e) => { e.stopPropagation(); closeWindow(rec.id); });
  el.addEventListener('pointerdown', () => focusWindow(rec.id), true);
  const tb = el.querySelector('.window-titlebar');
  tb.addEventListener('pointerdown', (e) => startDrag(e, rec, tb));
  tb.addEventListener('dblclick', (e) => { if (!e.target.closest('.window-btn')) toggleMaximize(rec.id); });
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

/** Run `move` for pointer drags on `target` with pointer capture (no document listeners to leak). */
function trackPointer(e, target, cls, rec, move) {
  target.setPointerCapture(e.pointerId);
  rec.el.classList.add(cls);
  const onMove = (ev) => move(ev);
  const end = () => {
    rec.el.classList.remove(cls);
    target.removeEventListener('pointermove', onMove);
    target.removeEventListener('pointerup', end);
    target.removeEventListener('pointercancel', end);
  };
  target.addEventListener('pointermove', onMove);
  target.addEventListener('pointerup', end);
  target.addEventListener('pointercancel', end);
}

function startDrag(e, rec, tb) {
  if (e.button !== 0 || rec.state === 'maximized' || e.target.closest('.window-btn')) return;
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
  if (e.button !== 0 || rec.state === 'maximized') return;
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
    const best = topVisible();
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
  if (rec.state === 'maximized') {
    rec.state = 'normal';
    rec.el.classList.remove('maximized');
    icon.setAttribute('href', '#i-max');
    btn.title = 'Maximize';
  } else {
    rec.el.classList.remove('minimized');
    rec.state = 'maximized';
    rec.el.classList.add('maximized');
    icon.setAttribute('href', '#i-restore');
    btn.title = 'Restore';
  }
  emit({ type: 'state', id });
}

/** Resolves true if the window closed, false if a beforeClose handler vetoed it. */
export async function closeWindow(id, force = false) {
  const rec = windows.get(id);
  if (!rec || rec.closing) return false;

  if (!force && rec.beforeClose) {
    rec.closing = true;
    let ok = true;
    try { ok = (await rec.beforeClose()) !== false; } catch (e) { console.error(e); }
    rec.closing = false;
    if (!ok) { focusWindow(id); return false; }
    if (!windows.has(id)) return true;
  }

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
