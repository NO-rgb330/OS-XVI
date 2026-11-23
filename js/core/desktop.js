/* ============================================================
   Desktop — free-positioned icons for apps, files and shortcuts.

   Three kinds of icon share one grid:
     · app   : a shortcut to an application (state.apps; removable,
               never backed by a VFS node). Losing the icon does not
               uninstall the app — the canonical entry stays in
               /home/user/SYSTEM APPS.
     · file  : a real item inside /home/user/Desktop.
     · link  : a shortcut to a file elsewhere.

   Dragging:
     · Single item   → HTML5 drag. App/file icons can be dropped into
                       Files, onto folders, or onto other windows.
     · Multi-select  → custom pointer drag (visible group-move,
                       layout preserved on release).
     · Link icons    → custom pointer drag (single or multi).

   External drops (files from the computer, including folders) land in
   UPLOADS and appear as shortcuts on the desktop.
   ============================================================ */

import * as vfs from './vfs.js';
import * as dialogs from './dialogs.js';
import { openWindow, blurAll } from './wm.js';
import { list as listApps, get as getApp } from './registry.js';
import { iconHTML } from './icons.js';
import { esc, joinPath, parentPath } from './util.js';
import { iconFor, openItem, createEntry, renameEntry, deleteEntries, transferInto, extractArchive, isArchive } from './files.js';
import { showMenu } from './contextmenu.js';
import { isMobile } from './mobile.js';
import { setClipboard, getClipboard, onClipboardChange, isCut, paste } from './clipboard.js';
import { hasPaths, hasFiles, readDragPaths, filesFromDrop, setDragPaths } from './dnd.js';
import { pickFiles, uploadFiles } from './upload.js';

export const DESKTOP = '/home/user/Desktop';

const STORE_KEY = 'os16.desktop.v1';
// Grid geometry. Phones get a tighter grid (kept in sync with css/mobile.css).
let PAD = 16, CELL_W = 96, CELL_H = 104, GAP = 4, STEP_X = 100, STEP_Y = 108;
function syncGrid() {
  const m = isMobile();
  PAD = m ? 10 : 16; CELL_W = m ? 82 : 96; CELL_H = m ? 92 : 104; GAP = 4;
  STEP_X = CELL_W + GAP; STEP_Y = CELL_H + GAP;
}
const DRAG_THRESHOLD = 5;

// ---------- Persistent layout ----------
const strings = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

function loadState() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(STORE_KEY)); } catch { /* corrupt or unavailable */ }
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    apps: strings(s.apps),
    seen: strings(s.seen),
    links: strings(s.links),
    pos: s.pos && typeof s.pos === 'object' && !Array.isArray(s.pos) ? s.pos : {}
  };
}

let state = loadState();

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
}

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
let items = [];
let placed = new Map();
const selected = new Set();
let renderSeq = 0;
let renderTimer = 0;

const isCell = (p) => Array.isArray(p) && Number.isInteger(p[0]) && Number.isInteger(p[1]) && p[0] >= 0 && p[1] >= 0;
const cellXY = (c, r) => ({ x: PAD + c * STEP_X, y: PAD + r * STEP_Y });

function metrics() {
  syncGrid();
  const w = container.clientWidth, h = container.clientHeight;
  return {
    cols: Math.max(1, Math.floor((w - 2 * PAD + GAP) / STEP_X)),
    rows: Math.max(1, Math.floor((h - 2 * PAD + GAP) / STEP_Y))
  };
}

function cellAt(clientX, clientY) {
  const { cols, rows } = metrics();
  const rect = container.getBoundingClientRect();
  const c = Math.floor((clientX - rect.left - PAD + GAP / 2) / STEP_X);
  const r = Math.floor((clientY - rect.top - PAD + GAP / 2) / STEP_Y);
  return [Math.max(0, Math.min(cols - 1, c)), Math.max(0, Math.min(rows - 1, r))];
}

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

function clampGroupDelta(origins, dcol, drow, cols, rows) {
  let minC = Infinity, maxC = -Infinity, minR = Infinity, maxR = -Infinity;
  for (const p of origins) {
    if (!Array.isArray(p)) continue;
    minC = Math.min(minC, p[0] + dcol);
    maxC = Math.max(maxC, p[0] + dcol);
    minR = Math.min(minR, p[1] + drow);
    maxR = Math.max(maxR, p[1] + drow);
  }
  if (!isFinite(minC)) return [dcol, drow];
  if (maxC - minC >= cols || maxR - minR >= rows) return [dcol, drow];
  if (minC < 0) dcol -= minC;
  if (maxC >= cols) dcol -= (maxC - cols + 1);
  if (minR < 0) drow -= minR;
  if (maxR >= rows) drow -= (maxR - rows + 1);
  return [dcol, drow];
}

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
    for (let c = 0; !cell; c++) {
      for (let r = 0; r < rows; r++) {
        if (!taken.has(key(c, r))) { cell = [c, r]; break; }
      }
    }
    taken.add(key(cell[0], cell[1]));
    result.set(it.key, cell);
    if (!isCell(state.pos[it.key])) { state.pos[it.key] = cell; dirty = true; }
  }
  if (dirty) save();
  return result;
}

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
      key: 'file:' + f.name, type: 'file', name: f.name, kind: f.kind,
      appId: f.appId, label: f.name, icon: iconFor(f)
    }))
  ];

  placed = assignCells(items);

  const live = new Set(items.map((i) => i.key));
  let pruned = false;
  for (const k of Object.keys(state.pos)) if (!live.has(k)) { delete state.pos[k]; pruned = true; }
  if (pruned) save();

  for (const k of [...selected]) if (!live.has(k)) selected.delete(k);

  container.innerHTML = items.map((it) => {
    const [c, r] = placed.get(it.key);
    const { x, y } = cellXY(c, r);
    const cls = 'desktop-icon' + (selected.has(it.key) ? ' selected' : '') + (it.type === 'link' ? ' is-link' : '')
      + (it.type === 'file' && isCut(DESKTOP, it.name) ? ' cut' : '');
    const draggable = (it.type === 'app' || it.type === 'file') ? ' draggable="true"' : '';
    return `<div class="${cls}" role="listitem" tabindex="0" data-key="${esc(it.key)}"${draggable} style="left:${x}px;top:${y}px" title="${esc(it.label)}">
      ${iconHTML(it.icon, 48)}
      <div class="desktop-icon-label">${esc(it.label)}</div>
    </div>`;
  }).join('');
}

function setSelection(keys) {
  selected.clear();
  for (const k of keys) selected.add(k);
  for (const el of container.children) {
    if (el.dataset.key) el.classList.toggle('selected', selected.has(el.dataset.key));
  }
}
const selectOnly = (key) => setSelection(key ? [key] : []);

const itemOf = (el) => items.find((i) => i.key === el?.dataset.key);
const selectedItems = () => items.filter((i) => selected.has(i.key));
const pathOfIcon = (it) => (it.type === 'link' ? it.path : joinPath(DESKTOP, it.name));

// ---------- Actions ----------
function openIcon(it) {
  if (!it) return;
  if (it.type === 'app') openWindow(it.id);
  else if (it.type === 'link') openItem(it.path, it.kind, it.label);
  else openItem(joinPath(DESKTOP, it.name), it.kind, it.name, it.appId);
}

async function removeIcons(list) {
  const apps = list.filter((i) => i.type === 'app');
  const links = list.filter((i) => i.type === 'link');
  const files = list.filter((i) => i.type === 'file');
  if (apps.length || links.length) {
    state.apps = state.apps.filter((id) => !apps.some((a) => a.id === id));
    state.links = state.links.filter((p) => !links.some((l) => l.path === p));
    for (const i of [...apps, ...links]) delete state.pos[i.key];
    save();
    scheduleRender(0);
  }
  if (files.length) await deleteEntries(DESKTOP, files.map((f) => f.name));
}

async function renameIcon(it) {
  if (it?.type !== 'file') return;
  const next = await renameEntry(DESKTOP, it.name);
  if (!next) return;
  if (state.pos[it.key]) { state.pos['file:' + next] = state.pos[it.key]; save(); }
  setSelection(['file:' + next]);
}

function clipboardSource(list, cut) {
  const files = list.filter((i) => i.type === 'file');
  if (files.length) return { dir: DESKTOP, names: files.map((f) => f.name) };
  if (cut) return null;
  const links = list.filter((i) => i.type === 'link');
  if (!links.length) return null;
  const dir = parentPath(links[0].path);
  const same = links.filter((l) => parentPath(l.path) === dir);
  return { dir, names: same.map((l) => l.label) };
}

function copyIcons(list, cut = false) {
  const src = clipboardSource(list, cut);
  if (src) setClipboard(cut ? 'cut' : 'copy', src.dir, src.names);
}

async function pasteToDesktop(cell) {
  if (!getClipboard()) return;
  const res = await paste(DESKTOP, {
    beforeEach: (finalName) => {
      const key = 'file:' + finalName;
      const spot = cell && nearestFree(cell, key);
      if (spot) { state.pos[key] = spot; placed.set(key, spot); }
    }
  });
  save();
  scheduleRender(0);
  if (res.done.length) setSelection(res.done.map((d) => 'file:' + d.to));
  if (res.errors.length) dialogs.alert('Paste', res.errors.join('\n'));
}

const paintCut = () => {
  for (const el of container?.children ?? []) {
    const it = itemOf(el);
    el.classList?.toggle('cut', !!it && it.type === 'file' && isCut(DESKTOP, it.name));
  }
};

async function extractIcon(it, here) {
  await extractArchive(pathOfIcon(it), { here });
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

async function dropPaths(data, cell, copy) {
  if (data.dir === DESKTOP && !copy) return;
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

function repositionGroup(keys, dropCell) {
  if (!keys.length) return;
  const { cols, rows } = metrics();

  const entries = keys
    .map((k) => [k, placed.get(k)])
    .filter(([, p]) => Array.isArray(p));
  if (!entries.length) return;

  const startCell = dragOrigin?.startCell;
  if (!startCell) {
    for (const [k] of entries) placed.delete(k);
    let [col, row] = dropCell;
    for (const [k] of entries) {
      col = Math.max(0, Math.min(cols - 1, col));
      row = Math.max(0, Math.min(rows - 1, row));
      const spot = nearestFree([col, row], null);
      if (spot) { placed.set(k, spot); state.pos[k] = spot; }
      col++;
      if (col >= cols) { col = 0; row++; }
    }
    save();
    scheduleRender(0);
    return;
  }

  const [dcolRaw, drowRaw] = [dropCell[0] - startCell[0], dropCell[1] - startCell[1]];
  const [dcol, drow] = clampGroupDelta(entries.map(([, p]) => p), dcolRaw, drowRaw, cols, rows);

  for (const [k] of entries) placed.delete(k);

  const ordered = [...entries].sort((a, b) => a[1][1] - b[1][1] || a[1][0] - b[1][0]);
  for (const [k, [oc, or_]] of ordered) {
    const want = [oc + dcol, or_ + drow];
    const spot = nearestFree(want, null);
    if (spot) { placed.set(k, spot); state.pos[k] = spot; }
  }

  save();
  scheduleRender(0);
}

// ---------- Menus ----------
function iconMenu(it, x, y) {
  const open = { label: it.type !== 'app' && it.kind !== 'dir' && isArchive(it.label) ? 'Extract…' : 'Open', action: () => openIcon(it) };
  const zip = it.type === 'file' && it.kind === 'file' && isArchive(it.label)
    ? [
        { label: `Extract to “${it.label.replace(/\.zip$/i, '') || 'archive'}/”`, action: () => extractIcon(it, false) },
        { label: 'Extract Here', action: () => extractIcon(it, true) }
      ]
    : [];
  if (it.type === 'app') {
    showMenu(x, y, [open, { sep: true }, { label: 'Remove from Desktop', action: () => removeIcons([it]) }]);
  } else if (it.type === 'link') {
    showMenu(x, y, [
      open, ...zip,
      { label: 'Show in Files', action: () => openWindow('files', { path: parentPath(it.path) }) },
      { sep: true },
      { label: 'Copy File', action: () => copyIcons([it]), hint: 'Ctrl+C' },
      { sep: true },
      { label: 'Remove from Desktop', action: () => removeIcons([it]), hint: 'Del' }
    ]);
  } else {
    showMenu(x, y, [
      open, ...zip,
      { sep: true },
      { label: 'Cut', action: () => copyIcons([it], true), hint: 'Ctrl+X' },
      { label: 'Copy', action: () => copyIcons([it]), hint: 'Ctrl+C' },
      { sep: true },
      { label: 'Rename', action: () => renameIcon(it), hint: 'F2' },
      { sep: true },
      { label: 'Delete', danger: true, action: () => removeIcons([it]), hint: 'Del' }
    ]);
  }
}

function multiMenu(list, x, y) {
  const shortcuts = list.filter((i) => i.type !== 'file');
  const files = list.filter((i) => i.type === 'file');
  const menu = [];
  if (files.length) {
    menu.push({ label: 'Cut', action: () => copyIcons(list, true), hint: 'Ctrl+X' },
      { label: 'Copy', action: () => copyIcons(list), hint: 'Ctrl+C' }, { sep: true });
  }
  if (shortcuts.length) menu.push({ label: `Remove ${shortcuts.length} icon${shortcuts.length === 1 ? '' : 's'} from Desktop`, action: () => removeIcons(shortcuts) });
  if (files.length) menu.push({ label: `Delete ${files.length} file${files.length === 1 ? '' : 's'}`, danger: true, action: () => removeIcons(files) });
  showMenu(x, y, menu);
}

function desktopMenu(x, y) {
  const cell = cellAt(x, y);
  const missing = listApps().some((a) => !state.apps.includes(a.id));
  showMenu(x, y, [
    { label: 'New Folder', action: () => createEntry(DESKTOP, 'dir') },
    { label: 'New Text File', action: () => createEntry(DESKTOP, 'file') },
    { sep: true },
    { label: 'Paste', action: () => pasteToDesktop(cell), disabled: !getClipboard(), hint: 'Ctrl+V' },
    {
      label: 'Upload Files…',
      action: async () => {
        const files = await pickFiles();
        if (files.length) await uploadToDesktop(files, cell);
      }
    },
    {
      label: 'Upload Folder…',
      action: async () => {
        const files = await pickFiles({ directory: true, multiple: true });
        if (files.length) await uploadToDesktop(files, cell);
      }
    },
    { sep: true },
    { label: 'Restore App Icons', action: restoreAppIcons, disabled: !missing },
    { label: 'Arrange Icons', action: arrangeIcons }
  ]);
}

// ---------- Pointer drag ----------
let suppressClick = false;
let dragOrigin = null;

function startIconDrag(e, el) {
  const key = el.dataset.key;
  const keys = selected.has(key) ? [...selected] : [key];
  const group = keys
    .map((k) => container.querySelector(`[data-key="${CSS.escape(k)}"]`))
    .filter(Boolean)
    .map((node) => ({ el: node, key: node.dataset.key, left: node.offsetLeft, top: node.offsetTop }));
  const startX = e.clientX, startY = e.clientY;
  const pid = e.pointerId;
  let dragging = false;
  let dx = 0, dy = 0;
  try { el.setPointerCapture(pid); } catch { /* pointer already gone */ }

  const onMove = (ev) => {
    if (ev.pointerId !== pid) return;
    dx = ev.clientX - startX;
    dy = ev.clientY - startY;
    if (!dragging) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      dragging = true;
      for (const g of group) g.el.classList.add('dragging');
    }
    for (const g of group) {
      g.el.style.left = g.left + dx + 'px';
      g.el.style.top = g.top + dy + 'px';
    }
  };

  const finish = (ev) => {
    if (ev.pointerId !== pid) return;
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', finish);
    el.removeEventListener('pointercancel', finish);
    if (!dragging) return;
    for (const g of group) g.el.classList.remove('dragging');
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);

    const orig = new Map(group.map((g) => [g.key, placed.get(g.key)]));

    if (ev.type === 'pointerup') {
      const { cols, rows } = metrics();
      let dcol = Math.round(dx / STEP_X);
      let drow = Math.round(dy / STEP_Y);
      [dcol, drow] = clampGroupDelta([...orig.values()], dcol, drow, cols, rows);

      for (const g of group) placed.delete(g.key);

      for (const g of [...group].sort((a, b) => a.left - b.left || a.top - b.top)) {
        const o = orig.get(g.key);
        if (!o) continue;
        const want = [o[0] + dcol, o[1] + drow];
        const spot = nearestFree(want, null);
        if (spot) {
          placed.set(g.key, spot);
          state.pos[g.key] = spot;
        }
      }
    }

    for (const g of group) {
      const spot = placed.get(g.key) ?? orig.get(g.key);
      if (!spot) continue;
      const { x, y } = cellXY(spot[0], spot[1]);
      g.el.style.left = x + 'px';
      g.el.style.top = y + 'px';
    }
    save();
  };

  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', finish);
  el.addEventListener('pointercancel', finish);
}

function startMarquee(e, base) {
  const crect = container.getBoundingClientRect();
  const sx = e.clientX - crect.left, sy = e.clientY - crect.top;
  const rects = [...container.querySelectorAll('.desktop-icon')].map((el) => ({
    key: el.dataset.key, l: el.offsetLeft, t: el.offsetTop, r: el.offsetLeft + el.offsetWidth, b: el.offsetTop + el.offsetHeight
  }));
  const pid = e.pointerId;
  let box = null;
  try { desktopEl.setPointerCapture(pid); } catch { /* pointer already gone */ }

  const onMove = (ev) => {
    if (ev.pointerId !== pid) return;
    const x = Math.max(0, Math.min(crect.width, ev.clientX - crect.left));
    const y = Math.max(0, Math.min(crect.height, ev.clientY - crect.top));
    if (!box) {
      if (Math.hypot(x - sx, y - sy) < 4) return;
      box = document.createElement('div');
      box.className = 'desktop-marquee';
      container.appendChild(box);
    }
    const l = Math.min(sx, x), t = Math.min(sy, y), r = Math.max(sx, x), b = Math.max(sy, y);
    Object.assign(box.style, { left: l + 'px', top: t + 'px', width: r - l + 'px', height: b - t + 'px' });
    const hits = rects.filter((i) => !(r < i.l || l > i.r || b < i.t || t > i.b)).map((i) => i.key);
    setSelection([...base, ...hits]);
  };
  const end = (ev) => {
    if (ev.pointerId !== pid) return;
    desktopEl.removeEventListener('pointermove', onMove);
    desktopEl.removeEventListener('pointerup', end);
    desktopEl.removeEventListener('pointercancel', end);
    box?.remove();
    if (box && selected.size) container.querySelector('.desktop-icon.selected')?.focus({ preventScroll: true });
  };
  desktopEl.addEventListener('pointermove', onMove);
  desktopEl.addEventListener('pointerup', end);
  desktopEl.addEventListener('pointercancel', end);
}

// ---------- Init ----------
export function initDesktop() {
  desktopEl = document.getElementById('desktop');
  container = document.getElementById('desktop-icons');
  syncApps();
  save();

  const iconOf = (e) => e.target.closest?.('.desktop-icon') ?? null;
  const additive = (e) => e.ctrlKey || e.metaKey || e.shiftKey;

  container.addEventListener('click', (e) => {
    if (suppressClick) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  container.addEventListener('click', (e) => {
    const el = iconOf(e);
    if (el && !additive(e)) {
      selectOnly(el.dataset.key);
      if (isMobile()) openIcon(itemOf(el));          // one tap opens on a phone
    }
  });
  container.addEventListener('dblclick', (e) => { const el = iconOf(e); if (el) openIcon(itemOf(el)); });

  container.addEventListener('keydown', (e) => {
    const el = iconOf(e);
    const it = itemOf(el);
    if (!it) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'a') setSelection(items.map((i) => i.key));
    else if (mod && e.key.toLowerCase() === 'c') copyIcons(selected.has(it.key) ? selectedItems() : [it]);
    else if (mod && e.key.toLowerCase() === 'x') copyIcons(selected.has(it.key) ? selectedItems() : [it], true);
    else if (e.key === 'Enter') openIcon(it);
    else if (e.key === 'Delete') removeIcons(selected.has(it.key) ? selectedItems() : [it]);
    else if (e.key === 'F2' && selected.size <= 1) renameIcon(it);
    else if (e.key === 'Escape') setSelection([]);
    else return;
    e.preventDefault();
  });

  container.addEventListener('dragstart', (e) => {
    const el = iconOf(e);
    if (!el || !el.draggable) return;

    if (selected.size > 1) { e.preventDefault(); return; }

    const it = itemOf(el);
    if (!it) { e.preventDefault(); return; }
    if (!selected.has(it.key)) selectOnly(it.key);

    dragOrigin = { startCell: cellAt(e.clientX, e.clientY) };

    if (it.type === 'app') {
      const appIds = { [it.label]: it.id };
      setDragPaths(e, '', [it.label], appIds);
      return;
    }
    if (it.type === 'file') {
      const appIds = {};
      if (it.kind === 'app' && it.appId) appIds[it.name] = it.appId;
      setDragPaths(e, DESKTOP, [it.name], appIds);
      return;
    }
  });

  container.addEventListener('pointerdown', (e) => {
    const el = iconOf(e);
    if (!el || e.button !== 0) return;
    const key = el.dataset.key;
    if (additive(e)) {
      setSelection(selected.has(key) ? [...selected].filter((k) => k !== key) : [...selected, key]);
      return;
    }
    if (!selected.has(key)) selectOnly(key);

    if (selected.size > 1) {
      startIconDrag(e, el);
      return;
    }
    if (el.draggable) return;
    startIconDrag(e, el);
  });

  desktopEl.addEventListener('pointerdown', (e) => {
    blurAll();
    if (iconOf(e)) return;
    if (e.button !== 0) { if (!additive(e)) setSelection([]); return; }
    const base = additive(e) ? new Set(selected) : new Set();
    if (!additive(e)) setSelection([]);
    if (isMobile()) return;                          // no rubber-band selection on a phone
    startMarquee(e, base);
  });

  desktopEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const el = iconOf(e);
    if (el) {
      if (!selected.has(el.dataset.key)) selectOnly(el.dataset.key);
      const sel = selectedItems();
      if (sel.length > 1) multiMenu(sel, e.clientX, e.clientY);
      else iconMenu(itemOf(el), e.clientX, e.clientY);
    } else {
      setSelection([]);
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
    const folder = over && itemOf(over)?.kind === 'dir' ? over : null;
    if (prev !== folder) { prev?.classList.remove('drop-target'); folder?.classList.add('drop-target'); }
  });

  desktopEl.addEventListener('drop', async (e) => {
    if (!accepts(e)) return;
    e.preventDefault();
    const target = itemOf(iconOf(e));
    const cell = cellAt(e.clientX, e.clientY);
    const copy = e.ctrlKey;
    const internal = hasPaths(e) ? readDragPaths(e) : null;
    // filesFromDrop is async — folder entries require recursive reads.
    const external = (!internal && hasFiles(e)) ? await filesFromDrop(e) : null;
    clearDrop();

    try {
      if (internal) {
        const folderTarget = target?.kind === 'dir' ? target : null;
        const fromDesktopApps = !internal.dir && internal.appIds && Object.keys(internal.appIds).length > 0;
        const fromDesktopFiles = internal.dir === DESKTOP;

        if (folderTarget) {
          const folderPath = pathOfIcon(target);

          if (fromDesktopApps) {
            const moved = [];
            for (const [name, appId] of Object.entries(internal.appIds)) {
              try {
                await vfs.writeApp(joinPath(folderPath, name), appId);
                moved.push(appId);
              } catch (err) {
                dialogs.toast(`${name}: ${err.message.replace(/^E[A-Z]+: /, '')}`, { danger: true });
              }
            }
            if (moved.length) dropAppFromDesktop(moved);
            dragOrigin = null;
            return;
          }

          if (internal.dir) {
            const names = internal.names.filter((n) => joinPath(internal.dir, n) !== folderPath);
            const res = await transferInto(internal.dir, names, folderPath, { copy });
            if (res.errors.length) dialogs.alert('Move', res.errors.join('\n'));
          }
          dragOrigin = null;
          return;
        }

        if (fromDesktopApps) {
          const keys = Object.values(internal.appIds).map((id) => 'app:' + id);
          repositionGroup(keys, cell);
          dragOrigin = null;
          return;
        }
        if (fromDesktopFiles && !copy) {
          const keys = internal.names.map((n) => 'file:' + n);
          repositionGroup(keys, cell);
          dragOrigin = null;
          return;
        }
        if (internal.dir) {
          await dropPaths(internal, cell, copy);
          dragOrigin = null;
          return;
        }
      } else if (external) {
        await uploadToDesktop(external.files, cell, external.skippedFolders);
      }
    } catch (err) {
      console.error(err);
      dialogs.alert('Desktop', err.message);
    } finally {
      dragOrigin = null;
    }
  });
  window.addEventListener('dragend', () => { dragOrigin = null; clearDrop(); });

  window.addEventListener('os16:app-dragged-out', (e) => {
    dropAppFromDesktop(e.detail?.appIds || []);
  });

  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== 'v') return;
    const t = e.target;
    const onDesktop = t === document.body || t === desktopEl || container.contains(t);
    if (!onDesktop || !document.getElementById('dialog-layer').hidden) return;
    e.preventDefault();
    pasteToDesktop();
  });
  onClipboardChange(paintCut);

  vfs.on('change', (path) => {
    if (path === DESKTOP || state.links.some((p) => parentPath(p) === path)) scheduleRender();
  });
  let resizeTimer = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 120); });
  // The desktop area can change size without a window resize (phone mode swaps the
  // panel layout), so re-lay-out icons whenever the container itself changes.
  if (typeof ResizeObserver === 'function') {
    let lastW = container.clientWidth, lastH = container.clientHeight;
    new ResizeObserver(() => {
      const w = container.clientWidth, h = container.clientHeight;
      if (w === lastW && h === lastH) return;
      lastW = w; lastH = h;
      clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 120);
    }).observe(container);
  }

  return render();
}

function dropAppFromDesktop(appIds) {
  if (!Array.isArray(appIds) || !appIds.length) return;
  const next = state.apps.filter((id) => !appIds.includes(id));
  if (next.length === state.apps.length) return;
  state.apps = next;
  for (const id of appIds) delete state.pos['app:' + id];
  save();
  scheduleRender(0);
}
