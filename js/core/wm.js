import { get as getApp } from './registry.js';

let nextZ = 0;
let nextId = 0;
const windows = new Map();
const listeners = new Set();
let focusedId = null;

function emit(event) { for (const fn of listeners) fn(event); }
export function on(cb) { listeners.add(cb); return () => listeners.delete(cb); }
export function listWindows() { return [...windows.values()]; }
export function getFocused() { return focusedId ? windows.get(focusedId) : null; }

export function openWindow(appId, args = {}) {
  const app = getApp(appId);
  if (!app) return null;
  if (app.singleton) {
    for (const w of windows.values()) {
      if (w.app.id === appId) { focusWindow(w.id); return w; }
    }
  }
  const size = args.size || app.defaultSize || [640, 480];
  const offset = (windows.size % 8) * 24;
  const rect = {
    x: Math.max(16, Math.round((window.innerWidth - size[0]) / 2) + offset),
    y: Math.max(16, Math.round((window.innerHeight - size[1]) / 2) + offset),
    w: size[0], h: size[1]
  };
  const rec = {
    id: 'w' + (++nextId),
    app, args, rect, state: 'normal',
    z: ++nextZ, title: app.name, el: null, bodyEl: null, cleanup: null
  };
  rec.el = buildWindowEl(rec);
  document.getElementById('window-layer').appendChild(rec.el);
  applyRect(rec);
  windows.set(rec.id, rec);
  focusWindow(rec.id);
  emit({ type: 'open', id: rec.id });
  try {
    const ctx = {
      close: () => closeWindow(rec.id),
      setTitle: (t) => setTitle(rec.id, t),
      onCleanup: (fn) => { rec.cleanup = fn; },
      rect: () => ({ ...rec.rect })
    };
    const result = app.launch?.(rec.bodyEl, args, ctx);
    Promise.resolve(result).then((c) => { if (typeof c === 'function') rec.cleanup = c; }).catch((e) => console.error(e));
  } catch (e) { console.error(e); }
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
    ${['n','s','e','w','nw','ne','sw','se'].map(d =>
      `<div class="window-resize window-resize-${d}" data-dir="${d}"></div>`).join('')}
  `;
  el.querySelector('.window-title').textContent = rec.title;
  rec.bodyEl = el.querySelector('.window-body');
  el.querySelector('.window-btn-min').addEventListener('click', (e) => { e.stopPropagation(); minimizeWindow(rec.id); });
  el.querySelector('.window-btn-max').addEventListener('click', (e) => { e.stopPropagation(); toggleMaximize(rec.id); });
  el.querySelector('.window-btn-close').addEventListener('click', (e) => { e.stopPropagation(); closeWindow(rec.id); });
  el.addEventListener('pointerdown', () => focusWindow(rec.id), true);
  const tb = el.querySelector('.window-titlebar');
  tb.addEventListener('pointerdown', (e) => startDrag(e, rec));
  tb.addEventListener('dblclick', () => toggleMaximize(rec.id));
  el.querySelectorAll('.window-resize').forEach((h) => {
    h.addEventListener('pointerdown', (e) => startResize(e, rec, h.dataset.dir));
  });
  return el;
}

function applyRect(rec) {
  const { x, y, w, h } = rec.rect;
  rec.el.style.left = x + 'px';
  rec.el.style.top = y + 'px';
  rec.el.style.width = w + 'px';
  rec.el.style.height = h + 'px';
}

function startDrag(e, rec) {
  if (e.button !== 0 || rec.state === 'maximized') return;
  const startX = e.clientX, startY = e.clientY;
  const x0 = rec.rect.x, y0 = rec.rect.y;
  rec.el.classList.add('dragging');
  const move = (ev) => {
    rec.rect.x = Math.max(-rec.rect.w + 80, Math.min(window.innerWidth - 80, x0 + ev.clientX - startX));
    rec.rect.y = Math.max(0, Math.min(window.innerHeight - 40, y0 + ev.clientY - startY));
    rec.el.style.left = rec.rect.x + 'px';
    rec.el.style.top = rec.rect.y + 'px';
  };
  const up = () => {
    rec.el.classList.remove('dragging');
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
  };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
}

function startResize(e, rec, dir) {
  if (e.button !== 0 || rec.state === 'maximized') return;
  e.stopPropagation();
  const startX = e.clientX, startY = e.clientY;
  const { x, y, w, h } = rec.rect;
  rec.el.classList.add('resizing');
  const move = (ev) => {
    const dx = ev.clientX - startX, dy = ev.clientY - startY;
    let nx = x, ny = y, nw = w, nh = h;
    if (dir.includes('e')) nw = Math.max(280, w + dx);
    if (dir.includes('s')) nh = Math.max(160, h + dy);
    if (dir.includes('w')) { nw = Math.max(280, w - dx); nx = x + (w - nw); }
    if (dir.includes('n')) { nh = Math.max(160, h - dy); ny = y + (h - nh); }
    rec.rect = { x: nx, y: ny, w: nw, h: nh };
    applyRect(rec);
  };
  const up = () => {
    rec.el.classList.remove('resizing');
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
  };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
}

export function focusWindow(id) {
  const rec = windows.get(id);
  if (!rec) return;
  if (rec.state === 'minimized') {
    rec.state = 'normal';
    rec.el.classList.remove('minimized');
  }
  if (focusedId === id) return;
  if (focusedId) {
    const prev = windows.get(focusedId);
    if (prev) prev.el.classList.remove('focused');
  }
  focusedId = id;
  rec.z = ++nextZ;
  rec.el.style.zIndex = rec.z;
  rec.el.classList.add('focused');
  emit({ type: 'focus', id });
}

export function blurAll() {
  if (!focusedId) return;
  const rec = windows.get(focusedId);
  if (rec) rec.el.classList.remove('focused');
  focusedId = null;
  emit({ type: 'focus', id: null });
}

export function minimizeWindow(id) {
  const rec = windows.get(id);
  if (!rec) return;
  rec.state = 'minimized';
  rec.el.classList.add('minimized');
  if (focusedId === id) {
    focusedId = null;
    let best = null;
    for (const w of windows.values()) if (w.state !== 'minimized' && (!best || w.z > best.z)) best = w;
    if (best) focusWindow(best.id);
    else emit({ type: 'focus', id: null });
  }
  emit({ type: 'state', id });
}

function toggleMaximize(id) {
  const rec = windows.get(id);
  if (!rec) return;
  const btn = rec.el.querySelector('.window-btn-max');
  if (rec.state === 'maximized') {
    rec.state = 'normal';
    rec.el.classList.remove('maximized');
    applyRect(rec);
    btn.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-max"/></svg>';
    btn.title = 'Maximize';
  } else {
    if (rec.state === 'minimized') { rec.state = 'normal'; rec.el.classList.remove('minimized'); }
    rec.state = 'maximized';
    rec.el.classList.add('maximized');
    btn.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-restore"/></svg>';
    btn.title = 'Restore';
  }
  emit({ type: 'state', id });
}

export function closeWindow(id) {
  const rec = windows.get(id);
  if (!rec) return;
  try { rec.cleanup?.(); } catch (e) { console.error(e); }
  rec.el.remove();
  windows.delete(id);
  if (focusedId === id) {
    focusedId = null;
    let best = null;
    for (const w of windows.values()) if (w.state !== 'minimized' && (!best || w.z > best.z)) best = w;
    if (best) focusWindow(best.id);
  }
  emit({ type: 'close', id });
}

export function setTitle(id, title) {
  const rec = windows.get(id);
  if (!rec) return;
  rec.title = title;
  rec.el.querySelector('.window-title').textContent = title;
  emit({ type: 'state', id });
}
