/* ============================================================
   Desktop — free-positioned icons for apps, files and shortcuts.

   Three kinds of icon share one grid:
     · app   : a shortcut to an application (state only; removable)
     · file  : a real item inside /home/user/Desktop
     · link  : a shortcut to a file elsewhere (e.g. something uploaded by
               dropping it on the desktop). Removing it never deletes the file.

   Layout (which apps are shown, shortcuts, icon positions) lives in localStorage.
   Positions are stored as grid cells so they survive window resizes.
   ============================================================ */

import * as vfs from './vfs.js';
import * as dialogs from './dialogs.js';
import { openWindow, blurAll } from './wm.js';
import { list as listApps, get as getApp } from './registry.js';
import { iconHTML } from './icons.js';
import { esc, joinPath, parentPath } from './util.js';
import { iconFor, openItem, createEntry, renameEntry, deleteEntries, transferInto } from './files.js';
import { showMenu } from './contextmenu.js';
import { hasPaths, hasFiles, readDragPaths, filesFromDrop } from './dnd.js';
import { pickFiles, uploadFiles } from './upload.js';

export const DESKTOP = '/home/user/Desktop';

const STORE_KEY = 'os16.desktop.v1';
const PAD = 16;
const CELL_W = 96, CELL_H = 104, GAP = 4;
const STEP_X = CELL_W + GAP, STEP_Y = CELL_H + GAP;
const DRAG_THRESHOLD = 5;

// ---------- Persistent layout ----------
const strings = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

function loadState() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(STORE_KEY)); } catch { /* corrupt or unavailable */ }
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    apps: strings(s.apps),      // app ids currently on the desktop, in order
    seen: strings(s.seen),      // app ids we've already offered (so removed ones stay removed)
    links: strings(s.links),    // paths of shortcut targets
    pos: s.pos && typeof s.pos === 'object' && !Array.isArray(s.pos) ? s.pos : {}  // key -> [col, row]
  };
}

let state = loadState();

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
}

/** New apps appear automatically once; apps the user removed stay removed. */
function syncApps() {
  const ids = listApps().map((a) => a.id);
  for (const id of ids) {
    if (state.seen.includes(id)) continue;
    state.seen.push(id);
    if (!state.apps.includes(id)) state.apps.push(id);
  }
  state.apps = state.apps.filter((id) => ids.includes(id));
}

export const hasAppIcon = (id) => state.apps.includes(id);

export function addAppIcon(id) {
  if (!getApp(id) || state.apps.includes(id)) return;
  state.apps.push(id);
  save();
  scheduleRender(0);
}

export function removeAppIcon(id) {
  if (!state.apps.includes(id)) return;
  state.apps = state.apps.filter((a) => a !== id);
  delete state.pos['app:' + id];
  save();
  scheduleRender(0);
}

// ---------- Grid ----------
let container = null;
let desktopEl = null;
let items = [];                 // current icons: { key, type, label, icon, ... }
let placed = new Map();         // key -> [col, row] as currently displayed
let selectedKey = null;
let renderSeq = 0;
let renderTimer = 0;

const isCell = (p) => Array.isArray(p) && Number.isInteger(p[0]) && Number.isInteger(p[1]) && p[0] >= 0 && p[1] >= 0;
const cellXY = (c, r) => ({ x: PAD + c * STEP_X, y: PAD + r * STEP_Y });

function metrics() {
  const w = container.clientWidth, h = container.clientHeight;
  return {
    cols: Math.max(1, Math.floor((w - 2 * PAD + GAP) / STEP_X)),
    rows: Math.max(1, Math.floor((h - 2 * PAD + GAP) / STEP_Y))
  };
}

/** Grid cell under a viewport point, clamped to the visible grid. */
function cellAt(clientX, clientY) {
  const { cols, rows } = metrics();
  const rect = container.getBoundingClientRect();
  const c = Math.floor((clientX - rect.left - PAD + GAP / 2) / STEP_X);
  const r = Math.floor((clientY - rect.top - PAD + GAP / 2) / STEP_Y);
  return [Math.max(0, Math.min(cols - 1, c)), Math.max(0, Math.min(rows - 1, r))];
}

/** Free cell closest to `want`, ignoring `exceptKey`'s own cell. Null if the grid is full. */
function nearestFree(want, exceptKey) {
  const { cols, rows } = metrics();
  const taken = new Set();
  for (const [k, p] of placed) if (k !== exceptKey) taken.add(p[0] + ',' + p[1]);
  let best = null, bestD = Infinity;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (taken.has(c + ',' + r)) continue;
      const d = (c - want[0]) ** 2 + (r - want[1]) ** 2;
      if (d < bestD) { bestD = d; best = [c, r]; }
    }
  }
  return best;
}

/** Decide a cell for every icon. Honours saved positions, flows new icons top-to-bottom, left-to-right. */
function assignCells(list) {
  const { cols, rows } = metrics();
  const result = new Map();
  const taken = new Set();
  const key = (c, r) => c + ',' + r;

  for (const it of list) {
    const p = state.pos[it.key];
    if (isCell(p) && p[0] < cols && p[1] < rows && !taken.has(key(p[0], p[1]))) {
      result.set(it.key, p);
      taken.add(key(p[0], p[1]));
    }
  }

  let dirty = false;
  for (const it of list) {
    if (result.has(it.key)) continue;
    let cell = null;
    for (let c = 0; !cell; c++) {          // columns are unbounded so nothing is ever dropped
      for (let r = 0; r < rows; r++) {
        if (!taken.has(key(c, r))) { cell = [c, r]; break; }
      }
    }
    taken.add(key(cell[0], cell[1]));
    result.set(it.key, cell);
    // Brand-new icons keep their spot. Icons that merely don't fit right now (small window)
    // are shown elsewhere temporarily without forgetting where the user put them.
    if (!isCell(state.pos[it.key])) { state.pos[it.key] = cell; dirty = true; }
  }
  if (dirty) save();
  return result;
}

// ---------- Rendering ----------
function scheduleRender(delay = 20) {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, delay);
}

async function render() {
  if (!container) return;
  const seq = ++renderSeq;

  let files;
  try { files = await vfs.list(DESKTOP); } catch (err) { console.error('Failed to load desktop', err); return; }

  const links = [];
  for (const path of state.links) {
    try {
      const st = await vfs.stat(path);
      links.push({ path, kind: st.kind, name: st.name });
    } catch { /* target is gone: drop the shortcut */ }
  }
  if (seq !== renderSeq) return;
  if (links.length !== state.links.length) {
    state.links = links.map((l) => l.path);
    save();
  }

  items = [
    ...state.apps.map((id) => {
      const app = getApp(id);
      return { key: 'app:' + id, type: 'app', id, label: app.name, icon: app.icon };
    }),
    ...links.map((l) => ({
      key: 'link:' + l.path, type: 'link', path: l.path, kind: l.kind, label: l.name,
      icon: iconFor({ kind: l.kind, name: l.name })
    })),
    ...files.map((f) => ({
      key: 'file:' + f.name, type: 'file', name: f.name, kind: f.kind, label: f.name, icon: iconFor(f)
    }))
  ];

  placed = assignCells(items);

  // Forget positions of things that no longer exist.
  const live = new Set(items.map((i) => i.key));
  let pruned = false;
  for (const k of Object.keys(state.pos)) if (!live.has(k)) { delete state.pos[k]; pruned = true; }
  if (pruned) save();

  if (selectedKey && !live.has(selectedKey)) selectedKey = null;

  container.innerHTML = items.map((it) => {
    const [c, r] = placed.get(it.key);
    const { x, y } = cellXY(c, r);
    const cls = 'desktop-icon' + (it.key === selectedKey ? ' selected' : '') + (it.type === 'link' ? ' is-link' : '');
    return `<div class="${cls}" role="listitem" tabindex="0" data-key="${esc(it.key)}" style="left:${x}px;top:${y}px" title="${esc(it.label)}">
      ${iconHTML(it.icon, 48)}
      <div class="desktop-icon-label">${esc(it.label)}</div>
    </div>`;
  }).join('');
}

function selectKey(key) {
  selectedKey = key;
  for (const el of container.children) el.classList.toggle('selected', el.dataset.key === key);
}

const itemOf = (el) => items.find((i) => i.key === el?.dataset.key);

// ---------- Actions ----------
function openIcon(it) {
  if (!it) return;
  if (it.type === 'app') openWindow(it.id);
  else if (it.type === 'link') openItem(it.path, it.kind, it.label);
  else openItem(joinPath(DESKTOP, it.name), it.kind, it.name);
}

function removeLink(path) {
  state.links = state.links.filter((p) => p !== path);
  delete state.pos['link:' + path];
  save();
  scheduleRender(0);
}

/** Apps and shortcuts leave the desktop; real files are deleted (after confirmation). */
async function removeIcon(it) {
  if (!it) return;
  if (it.type === 'app') removeAppIcon(it.id);
  else if (it.type === 'link') removeLink(it.path);
  else await deleteEntries(DESKTOP, [it.name]);
}

async function renameIcon(it) {
  if (it?.type !== 'file') return;
  const next = await renameEntry(DESKTOP, it.name);
  if (!next) return;
  // Keep the icon where it was (positions are keyed by name).
  if (state.pos[it.key]) { state.pos['file:' + next] = state.pos[it.key]; save(); }
  selectedKey = 'file:' + next;
}

function restoreAppIcons() {
  for (const app of listApps()) if (!state.apps.includes(app.id)) state.apps.push(app.id);
  save();
  scheduleRender(0);
}

function arrangeIcons() {
  state.pos = {};
  save();
  scheduleRender(0);
}

/** Upload files from the computer into UPLOADS and pin a shortcut for each one on the desktop. */
async function uploadToDesktop(files, cell, skippedFolders = 0) {
  const { saved } = await uploadFiles(files, { skippedFolders });
  if (!saved.length) return;
  for (const f of saved) {
    const key = 'link:' + f.path;
    if (!state.links.includes(f.path)) state.links.push(f.path);
    const spot = cell && nearestFree(cell, key);
    if (spot) { state.pos[key] = spot; placed.set(key, spot); }
  }
  save();
  scheduleRender(0);
}

/** Files dragged out of a Files window: move (or copy with Ctrl) onto the desktop, or into a folder icon. */
async function dropPaths(data, cell, copy, targetIcon) {
  const folder = targetIcon?.type === 'file' && targetIcon.kind === 'dir' ? targetIcon : null;
  if (folder) {
    const dst = joinPath(DESKTOP, folder.name);
    if (data.dir === dst && !copy) return;
    const res = await transferInto(data.dir, data.names.filter((n) => !(data.dir === DESKTOP && n === folder.name)), dst, { copy });
    if (res.errors.length) dialogs.alert('Move', res.errors.join('\n'));
    return;
  }
  if (data.dir === DESKTOP && !copy) return; // already on the desktop
  const res = await transferInto(data.dir, data.names, DESKTOP, {
    copy,
    beforeEach: (finalName) => {
      const key = 'file:' + finalName;
      const spot = nearestFree(cell, key);
      if (spot) { state.pos[key] = spot; placed.set(key, spot); }
    }
  });
  save();
  scheduleRender(0);
  if (res.errors.length) dialogs.alert('Move to Desktop', res.errors.join('\n'));
}

// ---------- Menus ----------
function iconMenu(it, x, y) {
  const open = { label: 'Open', action: () => openIcon(it) };
  if (it.type === 'app') {
    showMenu(x, y, [open, { sep: true }, { label: 'Remove from Desktop', action: () => removeIcon(it) }]);
  } else if (it.type === 'link') {
    showMenu(x, y, [
      open,
      { label: 'Show in Files', action: () => openWindow('files', { path: parentPath(it.path) }) },
      { sep: true },
      { label: 'Remove from Desktop', action: () => removeIcon(it), hint: 'Del' }
    ]);
  } else {
    showMenu(x, y, [
      open,
      { label: 'Rename', action: () => renameIcon(it), hint: 'F2' },
      { sep: true },
      { label: 'Delete', danger: true, action: () => removeIcon(it), hint: 'Del' }
    ]);
  }
}

function desktopMenu(x, y) {
  const cell = cellAt(x, y);
  const missing = listApps().some((a) => !state.apps.includes(a.id));
  showMenu(x, y, [
    { label: 'New Folder', action: () => createEntry(DESKTOP, 'dir') },
    { label: 'New Text File', action: () => createEntry(DESKTOP, 'file') },
    { sep: true },
    {
      label: 'Upload Files…',
      action: async () => {
        const files = await pickFiles();
        if (files.length) await uploadToDesktop(files, cell);
      }
    },
    { sep: true },
    { label: 'Restore App Icons', action: restoreAppIcons, disabled: !missing },
    { label: 'Arrange Icons', action: arrangeIcons }
  ]);
}

// ---------- Pointer: select, move ----------
let suppressClick = false;

function startIconDrag(e, el) {
  const key = el.dataset.key;
  const startX = e.clientX, startY = e.clientY;
  const left0 = el.offsetLeft, top0 = el.offsetTop;
  const pid = e.pointerId;
  let dragging = false;
  try { el.setPointerCapture(pid); } catch { /* pointer already gone */ }

  const onMove = (ev) => {
    if (ev.pointerId !== pid) return;
    const dx = ev.clientX - startX, dy = ev.clientY - startY;
    if (!dragging) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      dragging = true;
      el.classList.add('dragging');
    }
    el.style.left = left0 + dx + 'px';
    el.style.top = top0 + dy + 'px';
  };

  const finish = (ev) => {
    if (ev.pointerId !== pid) return;
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', finish);
    el.removeEventListener('pointercancel', finish);
    if (!dragging) return;
    el.classList.remove('dragging');
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);

    const orig = placed.get(key);
    let spot = null;
    if (ev.type === 'pointerup') {
      const { cols, rows } = metrics();
      const want = [
        Math.max(0, Math.min(cols - 1, Math.round((el.offsetLeft - PAD) / STEP_X))),
        Math.max(0, Math.min(rows - 1, Math.round((el.offsetTop - PAD) / STEP_Y)))
      ];
      spot = nearestFree(want, key);
    }
    spot ??= orig;           // cancelled, or no room: snap back
    if (!spot) return;
    placed.set(key, spot);
    state.pos[key] = spot;
    save();
    const { x, y } = cellXY(spot[0], spot[1]);
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  };

  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', finish);
  el.addEventListener('pointercancel', finish);
}

// ---------- Init ----------
export function initDesktop() {
  desktopEl = document.getElementById('desktop');
  container = document.getElementById('desktop-icons');
  syncApps();
  save();

  const iconOf = (e) => e.target.closest?.('.desktop-icon') ?? null;

  // Swallow the click that ends an icon drag.
  container.addEventListener('click', (e) => {
    if (suppressClick) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  container.addEventListener('click', (e) => { const el = iconOf(e); if (el) selectKey(el.dataset.key); });
  container.addEventListener('dblclick', (e) => { const el = iconOf(e); if (el) openIcon(itemOf(el)); });
  container.addEventListener('keydown', (e) => {
    const el = iconOf(e);
    const it = itemOf(el);
    if (!it) return;
    if (e.key === 'Enter') openIcon(it);
    else if (e.key === 'Delete') removeIcon(it);
    else if (e.key === 'F2') renameIcon(it);
    else return;
    e.preventDefault();
  });

  container.addEventListener('pointerdown', (e) => {
    const el = iconOf(e);
    if (!el || e.button !== 0) return;
    selectKey(el.dataset.key);
    startIconDrag(e, el);
  });

  desktopEl.addEventListener('pointerdown', (e) => {
    blurAll();
    if (!iconOf(e)) selectKey(null);
  });

  desktopEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const el = iconOf(e);
    if (el) {
      selectKey(el.dataset.key);
      iconMenu(itemOf(el), e.clientX, e.clientY);
    } else {
      selectKey(null);
      desktopMenu(e.clientX, e.clientY);
    }
  });

  // ---- Drag & drop onto the desktop ----
  let depth = 0;
  const clearDrop = () => { depth = 0; desktopEl.classList.remove('drop-active'); container.querySelector('.drop-target')?.classList.remove('drop-target'); };
  const accepts = (e) => hasPaths(e) || hasFiles(e);

  desktopEl.addEventListener('dragenter', (e) => { if (accepts(e)) depth++; });
  desktopEl.addEventListener('dragleave', (e) => { if (accepts(e) && --depth <= 0) clearDrop(); });
  desktopEl.addEventListener('dragover', (e) => {
    if (!accepts(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = hasFiles(e) ? 'copy' : (e.ctrlKey ? 'copy' : 'move');
    desktopEl.classList.add('drop-active');
    const prev = container.querySelector('.drop-target');
    const over = hasPaths(e) ? iconOf(e) : null;
    const folder = over && itemOf(over)?.kind === 'dir' && itemOf(over)?.type === 'file' ? over : null;
    if (prev !== folder) { prev?.classList.remove('drop-target'); folder?.classList.add('drop-target'); }
  });
  desktopEl.addEventListener('drop', async (e) => {
    if (!accepts(e)) return;
    e.preventDefault();
    const target = itemOf(iconOf(e));
    const cell = cellAt(e.clientX, e.clientY);
    const copy = e.ctrlKey;
    const internal = hasPaths(e) ? readDragPaths(e) : null;
    const external = !internal && hasFiles(e) ? filesFromDrop(e) : null;
    clearDrop();
    try {
      if (internal) await dropPaths(internal, cell, copy, target);
      else if (external) await uploadToDesktop(external.files, cell, external.skippedFolders);
    } catch (err) {
      console.error(err);
      dialogs.alert('Desktop', err.message);
    }
  });
  window.addEventListener('dragend', clearDrop);

  // ---- Keep in sync ----
  vfs.on('change', (path) => {
    if (path === DESKTOP || state.links.some((p) => parentPath(p) === path)) scheduleRender();
  });
  let resizeTimer = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 120); });

  return render();
}
