import * as vfs from '../core/vfs.js';
import * as dialogs from '../core/dialogs.js';
import { iconHTML } from '../core/icons.js';
import { esc, joinPath, parentPath, baseName, formatBytes, formatDate } from '../core/util.js';
import { iconFor, openItem, createEntry, renameEntry, deleteEntries } from '../core/files.js';
import { showMenu } from '../core/contextmenu.js';

const HOME = '/home/user';
const PLACES = [
  ['Home', 'home', HOME],
  ['Desktop', 'desktop', HOME + '/Desktop'],
  ['Documents', 'file-text', HOME + '/Documents'],
  ['Pictures', 'file-image', HOME + '/Pictures'],
  ['Music', 'file-audio', HOME + '/Music'],
  ['Videos', 'file-video', HOME + '/Videos'],
  ['Downloads', 'download', HOME + '/Downloads'],
  ['File System', 'folder', '/']
];

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const byName = (a, b) => collator.compare(a.name, b.name);
const SORTERS = {
  name: byName,
  size: (a, b) => (a.size || 0) - (b.size || 0) || byName(a, b),
  mtime: (a, b) => (a.mtime || 0) - (b.mtime || 0) || byName(a, b)
};

const tpl = (cmd, title, icon) =>
  `<button class="toolbar-btn" data-cmd="${cmd}" title="${title}" aria-label="${title}">${iconHTML(icon, 14)}</button>`;

export const fileManagerApp = {
  id: 'files',
  name: 'Files',
  icon: 'folder',
  defaultSize: [820, 540],

  launch(body, args, ctx) {
    let cwd = null;
    let items = [];
    let viewMode = 'list';
    let sortKey = 'name';
    let sortDir = 'asc';
    let anchor = null;               // last clicked name (range select / keyboard cursor)
    const selected = new Set();
    const back = [];
    const fwd = [];

    body.innerHTML = `
      <div class="fm-app" tabindex="0">
        <div class="app-toolbar fm-toolbar">
          ${tpl('back', 'Back (Alt+Left)', 'chevron-left')}
          ${tpl('fwd', 'Forward (Alt+Right)', 'chevron-right')}
          ${tpl('up', 'Up (Backspace)', 'up')}
          ${tpl('refresh', 'Refresh (F5)', 'refresh')}
          <nav class="fm-pathbar" aria-label="Location"></nav>
          ${tpl('newfolder', 'New Folder', 'folder-plus')}
          ${tpl('newfile', 'New Text File', 'file-plus')}
          <div class="toolbar-sep"></div>
          ${tpl('view', 'Toggle view', 'grid')}
        </div>
        <div class="app-split">
          <nav class="app-sidebar fm-sidebar" aria-label="Places">
            <div class="sidebar-group">
              <div class="sidebar-group-title">Places</div>
              ${PLACES.map(([label, icon, path]) => `
                <button type="button" class="sidebar-item" data-path="${esc(path)}">
                  ${iconHTML(icon, 14)}<span class="label">${esc(label)}</span>
                </button>`).join('')}
            </div>
          </nav>
          <div class="app-main">
            <div class="fm-list-area">
              <div class="fm-head" role="row">
                <button type="button" data-sort="name">Name${iconHTML('chevron-down', 10)}</button>
                <button type="button" class="num" data-sort="size">Size${iconHTML('chevron-down', 10)}</button>
                <button type="button" data-sort="mtime" data-col="mtime">Modified${iconHTML('chevron-down', 10)}</button>
              </div>
              <div class="fm-list" role="listbox" aria-multiselectable="true"></div>
            </div>
          </div>
        </div>
        <div class="app-statusbar">
          <div class="sb-cell grow sb-count"></div>
          <div class="sb-cell sb-sel"></div>
        </div>
      </div>`;

    const $ = (sel) => body.querySelector(sel);
    const elApp = $('.fm-app');
    const elPath = $('.fm-pathbar');
    const elArea = $('.fm-list-area');
    const elHead = $('.fm-head');
    const elList = $('.fm-list');
    const elCount = $('.sb-count');
    const elSel = $('.sb-sel');
    const btn = (cmd) => body.querySelector(`[data-cmd="${cmd}"]`);

    const pathOf = (name) => joinPath(cwd, name);
    const itemByName = (name) => items.find((i) => i.name === name);
    const focusApp = () => elApp.focus({ preventScroll: true });

    // ---------- Rendering ----------
    function renderPathbar() {
      const parts = cwd.split('/').filter(Boolean);
      let acc = '';
      elPath.innerHTML =
        `<button type="button" class="fm-crumb${parts.length ? '' : ' active'}" data-path="/">File System</button>` +
        parts.map((p, i) => {
          acc += '/' + p;
          return `${iconHTML('chevron-right', 10)}<button type="button" class="fm-crumb${i === parts.length - 1 ? ' active' : ''}" data-path="${esc(acc)}">${esc(p)}</button>`;
        }).join('');
      elPath.scrollLeft = elPath.scrollWidth;
    }

    function syncNav() {
      btn('back').disabled = !back.length;
      btn('fwd').disabled = !fwd.length;
      btn('up').disabled = cwd === '/';
      body.querySelectorAll('.sidebar-item').forEach((el) =>
        el.classList.toggle('active', el.dataset.path === cwd));
      ctx.setTitle(`${baseName(cwd) || 'File System'} — Files`);
    }

    function rowHTML(it) {
      const sel = selected.has(it.name);
      return `<div class="fm-row${sel ? ' selected' : ''}" role="option" aria-selected="${sel}" data-name="${esc(it.name)}">
        <div class="fm-cell fm-name">${iconHTML(iconFor(it), 16)}<span>${esc(it.name)}</span></div>
        <div class="fm-cell fm-size">${it.kind === 'dir' ? '—' : formatBytes(it.size)}</div>
        <div class="fm-cell fm-date" data-col="mtime">${formatDate(it.mtime)}</div>
      </div>`;
    }

    function tileHTML(it) {
      const sel = selected.has(it.name);
      return `<div class="fm-tile${sel ? ' selected' : ''}" role="option" aria-selected="${sel}" data-name="${esc(it.name)}" title="${esc(it.name)}">
        ${iconHTML(iconFor(it), 40)}<div class="fm-tile-label">${esc(it.name)}</div>
      </div>`;
    }

    function sortItems() {
      const cmp = SORTERS[sortKey];
      const dir = sortDir === 'asc' ? 1 : -1;
      items.sort((a, b) => (a.kind !== b.kind ? (a.kind === 'dir' ? -1 : 1) : dir * cmp(a, b)));
    }

    function render() {
      const isList = viewMode === 'list';
      elHead.hidden = !isList;
      elList.className = isList ? 'fm-list' : 'fm-list fm-grid';
      elList.innerHTML = items.length
        ? items.map(isList ? rowHTML : tileHTML).join('')
        : `<div class="app-empty fm-empty">${iconHTML('folder', 40)}<div>This folder is empty</div></div>`;

      elHead.querySelectorAll('[data-sort]').forEach((b) => {
        const active = b.dataset.sort === sortKey;
        b.classList.toggle('active', active);
        b.classList.toggle('asc', active && sortDir === 'asc');
      });
      btn('view').innerHTML = iconHTML(isList ? 'grid' : 'list', 14);
      btn('view').title = isList ? 'Switch to grid view' : 'Switch to list view';
      updateStatus();
    }

    function updateStatus() {
      elCount.textContent = `${items.length} item${items.length === 1 ? '' : 's'}`;
      if (!selected.size) { elSel.textContent = ''; return; }
      let bytes = 0;
      for (const n of selected) bytes += itemByName(n)?.size || 0;
      elSel.textContent = `${selected.size} selected${bytes ? ' · ' + formatBytes(bytes) : ''}`;
    }

    /** Apply `selected` to the DOM by toggling classes (no re-render). */
    function syncSelection() {
      for (const el of elList.children) {
        const sel = selected.has(el.dataset.name);
        el.classList.toggle('selected', sel);
        el.setAttribute('aria-selected', sel);
      }
      updateStatus();
    }

    function setSelection(names, newAnchor = anchor) {
      selected.clear();
      for (const n of names) selected.add(n);
      anchor = newAnchor;
      syncSelection();
    }

    // ---------- Loading / navigation ----------
    let loadSeq = 0;

    /** Load `path` into the view. Returns an Error on failure, otherwise null. */
    async function load(path, { select } = {}) {
      const seq = ++loadSeq;
      let list;
      try { list = await vfs.list(path); } catch (err) { return err; }
      if (seq !== loadSeq) return null; // superseded by a newer load
      const changedDir = path !== cwd;
      cwd = path;
      items = list;
      sortItems();
      const keep = changedDir ? [] : [...selected].filter((n) => itemByName(n));
      selected.clear();
      for (const n of select ? [select] : keep) selected.add(n);
      if (changedDir || select) anchor = select ?? null;
      renderPathbar();
      syncNav();
      render();
      if (select) elList.querySelector(`[data-name="${CSS.escape(select)}"]`)?.scrollIntoView({ block: 'nearest' });
      if (changedDir) elArea.scrollTop = 0;
      return null;
    }

    async function navigate(path, { push = true } = {}) {
      const prev = cwd;
      const err = await load(path);
      if (err) {
        await dialogs.alert('Error', `Cannot open folder: ${err.message}`);
        return false;
      }
      if (push && prev && prev !== path) { back.push(prev); fwd.length = 0; syncNav(); }
      return true;
    }

    async function refresh(select) {
      const err = await load(cwd, { select });
      // Current folder vanished (deleted elsewhere): fall back to the nearest parent.
      if (err && cwd !== '/') await navigate(parentPath(cwd), { push: false });
    }

    async function goBack() {
      if (!back.length) return;
      const target = back.pop();
      const from = cwd;
      if (await load(target) === null) { fwd.push(from); syncNav(); } else back.push(target);
    }
    async function goForward() {
      if (!fwd.length) return;
      const target = fwd.pop();
      const from = cwd;
      if (await load(target) === null) { back.push(from); syncNav(); } else fwd.push(target);
    }
    const goUp = () => { if (cwd !== '/') navigate(parentPath(cwd)); };

    // ---------- Actions ----------
    const selectedItems = () => [...selected].map(itemByName).filter(Boolean);

    function openSelected() {
      const [it] = selectedItems();
      if (selected.size === 1 && it) openEntry(it);
    }
    function openEntry(it) {
      if (it.kind === 'dir') navigate(pathOf(it.name));
      else openItem(pathOf(it.name), it.kind, it.name);
    }
    async function newEntry(kind) {
      const name = await createEntry(cwd, kind);
      if (name) await refresh(name);
    }
    async function renameSelected() {
      if (selected.size !== 1) return;
      const name = await renameEntry(cwd, [...selected][0]);
      if (name) await refresh(name);
    }
    async function deleteSelected() {
      if (await deleteEntries(cwd, [...selected])) { selected.clear(); await refresh(); }
    }
    function toggleView() { viewMode = viewMode === 'list' ? 'grid' : 'list'; render(); }
    function setSort(key) {
      if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      else { sortKey = key; sortDir = 'asc'; }
      sortItems();
      render();
    }

    const COMMANDS = {
      back: goBack, fwd: goForward, up: goUp, refresh: () => refresh(),
      newfolder: () => newEntry('dir'), newfile: () => newEntry('file'), view: toggleView
    };

    // ---------- Pointer & menu events (all delegated) ----------
    $('.fm-toolbar').addEventListener('click', (e) => {
      const b = e.target.closest('[data-cmd]');
      if (b) { COMMANDS[b.dataset.cmd]?.(); focusApp(); }
    });
    elPath.addEventListener('click', (e) => {
      const c = e.target.closest('[data-path]');
      if (c && c.dataset.path !== cwd) navigate(c.dataset.path);
    });
    $('.fm-sidebar').addEventListener('click', (e) => {
      const c = e.target.closest('[data-path]');
      if (c && c.dataset.path !== cwd) navigate(c.dataset.path);
      focusApp();
    });
    elHead.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sort]');
      if (b) setSort(b.dataset.sort);
    });

    elList.addEventListener('click', (e) => {
      const row = e.target.closest('[data-name]');
      if (!row) return;
      const name = row.dataset.name;
      const toggle = e.ctrlKey || e.metaKey;
      if (e.shiftKey && anchor != null) {
        const a = items.findIndex((i) => i.name === anchor);
        const b = items.findIndex((i) => i.name === name);
        const range = items.slice(Math.min(a, b), Math.max(a, b) + 1).map((i) => i.name);
        setSelection(toggle ? [...selected, ...range] : range, anchor);
      } else if (toggle) {
        if (!selected.delete(name)) selected.add(name);
        anchor = name;
        syncSelection();
      } else {
        setSelection([name], name);
      }
    });
    elList.addEventListener('dblclick', (e) => {
      const row = e.target.closest('[data-name]');
      const it = row && itemByName(row.dataset.name);
      if (it) openEntry(it);
    });

    elArea.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const row = e.target.closest('[data-name]');
      if (row) {
        if (!selected.has(row.dataset.name)) setSelection([row.dataset.name], row.dataset.name);
        const one = selected.size === 1;
        showMenu(e.clientX, e.clientY, [
          { label: 'Open', action: openSelected, disabled: !one },
          { label: 'Rename', action: renameSelected, disabled: !one, hint: 'F2' },
          { sep: true },
          { label: 'Delete', action: deleteSelected, danger: true, hint: 'Del' }
        ]);
      } else {
        setSelection([]);
        showMenu(e.clientX, e.clientY, [
          { label: 'New Folder', action: () => newEntry('dir') },
          { label: 'New Text File', action: () => newEntry('file') },
          { sep: true },
          { label: 'Refresh', action: () => refresh(), hint: 'F5' }
        ]);
      }
    });

    // ---------- Marquee selection (rects measured once per drag) ----------
    let mq = null;

    elArea.addEventListener('pointerdown', (e) => {
      focusApp();
      if (e.button !== 0 || e.target.closest('[data-name], .fm-head')) return;
      const box = elArea.getBoundingClientRect();
      // Ignore presses on the scrollbars.
      if (e.clientX >= box.left + elArea.clientWidth || e.clientY >= box.top + elArea.clientHeight) return;

      const additive = e.ctrlKey || e.metaKey || e.shiftKey;
      const base = additive ? new Set(selected) : new Set();
      if (!additive && selected.size) setSelection([]);

      const ox = box.left - elArea.scrollLeft, oy = box.top - elArea.scrollTop;
      const rects = [...elList.querySelectorAll('[data-name]')].map((el) => {
        const r = el.getBoundingClientRect();
        return { el, name: el.dataset.name, l: r.left - ox, t: r.top - oy, r: r.right - ox, b: r.bottom - oy };
      });
      const el = document.createElement('div');
      el.className = 'fm-marquee';
      elArea.appendChild(el);
      mq = { sx: e.clientX - ox, sy: e.clientY - oy, ox, oy, rects, base, el, raf: 0, ev: null };
      elArea.setPointerCapture(e.pointerId);
    });

    const updateMarquee = () => {
      if (!mq) return;
      mq.raf = 0;
      const cx = mq.ev.clientX - mq.ox, cy = mq.ev.clientY - mq.oy;
      const l = Math.min(mq.sx, cx), t = Math.min(mq.sy, cy);
      const r = Math.max(mq.sx, cx), b = Math.max(mq.sy, cy);
      Object.assign(mq.el.style, { left: l + 'px', top: t + 'px', width: r - l + 'px', height: b - t + 'px' });
      let changed = false;
      for (const it of mq.rects) {
        const hit = !(r < it.l || l > it.r || b < it.t || t > it.b);
        const want = hit || mq.base.has(it.name);
        if (want !== selected.has(it.name)) {
          if (want) selected.add(it.name); else selected.delete(it.name);
          it.el.classList.toggle('selected', want);
          it.el.setAttribute('aria-selected', want);
          changed = true;
        }
      }
      if (changed) updateStatus();
    };
    elArea.addEventListener('pointermove', (e) => {
      if (!mq) return;
      mq.ev = e;
      if (!mq.raf) mq.raf = requestAnimationFrame(updateMarquee);
    });
    const endMarquee = () => {
      if (!mq) return;
      cancelAnimationFrame(mq.raf);
      mq.el.remove();
      mq = null;
    };
    elArea.addEventListener('pointerup', endMarquee);
    elArea.addEventListener('pointercancel', endMarquee);

    // ---------- Keyboard ----------
    function moveCursor(delta, extend) {
      if (!items.length) return;
      const cur = items.findIndex((i) => i.name === anchor);
      const next = Math.max(0, Math.min(items.length - 1, cur < 0 ? (delta > 0 ? 0 : items.length - 1) : cur + delta));
      const name = items[next].name;
      if (extend && cur >= 0) {
        const [lo, hi] = [Math.min(cur, next), Math.max(cur, next)];
        setSelection(items.slice(lo, hi + 1).map((i) => i.name), anchor);
      } else {
        setSelection([name], name);
      }
      elList.querySelector(`[data-name="${CSS.escape(name)}"]`)?.scrollIntoView({ block: 'nearest' });
    }
    const gridColumns = () => {
      const tiles = elList.children;
      if (!tiles.length) return 1;
      let n = 1;
      while (n < tiles.length && tiles[n].offsetTop === tiles[0].offsetTop) n++;
      return n;
    };

    elApp.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const grid = viewMode === 'grid';
      let handled = true;
      if (e.altKey && e.key === 'ArrowLeft') goBack();
      else if (e.altKey && e.key === 'ArrowRight') goForward();
      else if (e.altKey && e.key === 'ArrowUp') goUp();
      else if (mod && e.key.toLowerCase() === 'a') setSelection(items.map((i) => i.name), anchor);
      else if (e.altKey || mod) handled = false;
      else switch (e.key) {
        case 'Enter': openSelected(); break;
        case 'Delete': deleteSelected(); break;
        case 'F2': renameSelected(); break;
        case 'F5': refresh(); break;
        case 'Backspace': goUp(); break;
        case 'Escape': setSelection([]); break;
        case 'ArrowDown': moveCursor(grid ? gridColumns() : 1, e.shiftKey); break;
        case 'ArrowUp': moveCursor(grid ? -gridColumns() : -1, e.shiftKey); break;
        case 'ArrowRight': if (grid) moveCursor(1, e.shiftKey); else handled = false; break;
        case 'ArrowLeft': if (grid) moveCursor(-1, e.shiftKey); else handled = false; break;
        default: handled = false;
      }
      if (handled) e.preventDefault();
    });

    // ---------- Lifecycle ----------
    let refreshTimer = 0;
    const unsub = vfs.on('change', (path) => {
      if (path !== cwd) return;
      clearTimeout(refreshTimer); // coalesce bursts (e.g. deleting many items)
      refreshTimer = setTimeout(() => refresh(), 20);
    });
    ctx.onCleanup(() => { unsub(); clearTimeout(refreshTimer); endMarquee(); });
    ctx.onFocus(focusApp);

    return navigate(args.path || HOME).then(async (ok) => {
      if (!ok) await navigate('/');
      focusApp();
    });
  }
};
