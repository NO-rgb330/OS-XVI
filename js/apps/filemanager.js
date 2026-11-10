import * as vfs from '../core/vfs.js';
import * as dialogs from '../core/dialogs.js';
import { iconHTML } from '../core/icons.js';
import { esc, joinPath, parentPath, baseName, formatBytes, formatDate } from '../core/util.js';
import { iconFor, openItem, createEntry, renameEntry, deleteEntries, transferInto, extractArchive, isArchive } from '../core/files.js';
import { showMenu } from '../core/contextmenu.js';
import { setClipboard, getClipboard, onClipboardChange, isCut, paste } from '../core/clipboard.js';
import { setDragPaths, readDragPaths, hasPaths, hasFiles, filesFromDrop } from '../core/dnd.js';
import { buildZip } from '../core/zip.js';
import { pickFiles, uploadFiles, UPLOADS_DIR } from '../core/upload.js';
import { SYSTEM_APPS_DIR } from '../core/vfs.js';

const HOME = '/home/user';
const PLACES = [
  ['Home', 'home', HOME],
  ['Desktop', 'desktop', HOME + '/Desktop'],
  ['Documents', 'file-text', HOME + '/Documents'],
  ['Pictures', 'file-image', HOME + '/Pictures'],
  ['Music', 'file-audio', HOME + '/Music'],
  ['Videos', 'file-video', HOME + '/Videos'],
  ['Downloads', 'download', HOME + '/Downloads'],
  ['UPLOADS', 'upload', UPLOADS_DIR],
  ['System Apps', 'grid', SYSTEM_APPS_DIR],
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
    let anchor = null;
    let view = 'files';
    let storageTab = 'used';
    let disk = null;
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
          ${tpl('cut', 'Cut (Ctrl+X)', 'cut')}
          ${tpl('copy', 'Copy (Ctrl+C)', 'copy')}
          ${tpl('paste', 'Paste (Ctrl+V)', 'paste')}
          <div class="toolbar-sep"></div>
          ${tpl('upload', 'Upload files from your computer (saved to UPLOADS)', 'upload')}
          ${tpl('download', 'Save to Device (download)', 'download')}
          ${tpl('extract', 'Extract the selected .zip into a new folder', 'archive')}
          <div class="toolbar-sep"></div>
          ${tpl('storage', 'Storage: total used / left', 'disk')}
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
            <div class="sidebar-group fm-storage-group">
              <div class="sidebar-group-title">Storage</div>
              <button type="button" class="sidebar-item fm-store-tab" data-store="used" title="Total storage used">
                ${iconHTML('disk', 14)}<span class="label">Total storage used</span><span class="fm-store-val" data-val="used">…</span>
              </button>
              <button type="button" class="sidebar-item fm-store-tab" data-store="left" title="Total storage left">
                ${iconHTML('disk', 14)}<span class="label">Total storage left</span><span class="fm-store-val" data-val="left">…</span>
              </button>
              <div class="fm-meter" aria-hidden="true"><div class="fm-meter-fill"></div></div>
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
            <div class="fm-storage" hidden>
              <div class="fm-tabs" role="tablist" aria-label="Virtual disk">
                <button type="button" role="tab" data-store="used">Total storage used</button>
                <button type="button" role="tab" data-store="left">Total storage left</button>
              </div>
              <div class="fm-tabpanel" role="tabpanel"></div>
            </div>
          </div>
        </div>
        <div class="app-statusbar">
          <div class="sb-cell grow sb-count"></div>
          <div class="sb-cell sb-sel"></div>
          <button type="button" class="sb-cell sb-disk" data-cmd="storage" title="Virtual disk: click for details"></button>
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
    const elDisk = $('.sb-disk');
    const elStorage = $('.fm-storage');
    const elStoragePanel = $('.fm-tabpanel');
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
      const inFiles = view === 'files';
      body.querySelectorAll('.sidebar-item[data-path]').forEach((el) =>
        el.classList.toggle('active', inFiles && el.dataset.path === cwd));
      body.querySelectorAll('.fm-store-tab').forEach((el) =>
        el.classList.toggle('active', !inFiles && el.dataset.store === storageTab));
      btn('storage').setAttribute('aria-pressed', String(!inFiles));
      ctx.setTitle(inFiles ? `${baseName(cwd) || 'File System'} — Files` : 'Storage — Files');
    }

    function rowHTML(it) {
      const sel = selected.has(it.name);
      const sizeCell = it.kind === 'app' ? 'App' : it.kind === 'dir' ? '—' : formatBytes(it.size);
      return `<div class="fm-row${sel ? ' selected' : ''}${isCut(cwd, it.name) ? ' cut' : ''}" draggable="true" role="option" aria-selected="${sel}" data-name="${esc(it.name)}">
        <div class="fm-cell fm-name">${iconHTML(iconFor(it), 16)}<span>${esc(it.name)}</span></div>
        <div class="fm-cell fm-size">${sizeCell}</div>
        <div class="fm-cell fm-date" data-col="mtime">${formatDate(it.mtime)}</div>
      </div>`;
    }

    function tileHTML(it) {
      const sel = selected.has(it.name);
      return `<div class="fm-tile${sel ? ' selected' : ''}${isCut(cwd, it.name) ? ' cut' : ''}" draggable="true" role="option" aria-selected="${sel}" data-name="${esc(it.name)}" title="${esc(it.name)}">
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
      const sel = selectedItems();
      const anyProtected = sel.some((it) => it.protected);
      const hasFiles = sel.some((it) => it.kind === 'file');

      btn('extract').disabled = view !== 'files' || !selectedZip();
      btn('download').disabled = view !== 'files' || !hasFiles;
      btn('cut').disabled = view !== 'files' || !sel.length || anyProtected;
      btn('copy').disabled = view !== 'files' || !sel.length;
      btn('paste').disabled = view !== 'files' || !getClipboard();
      if (view === 'storage') { elCount.textContent = 'Virtual disk'; elSel.textContent = ''; return; }
      elCount.textContent = `${items.length} item${items.length === 1 ? '' : 's'}`;
      if (!sel.length) { elSel.textContent = ''; return; }
      let bytes = 0;
      for (const it of sel) bytes += it.size || 0;
      elSel.textContent = `${sel.length} selected${bytes ? ' · ' + formatBytes(bytes) : ''}`;
    }

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

    async function load(path, { select } = {}) {
      const seq = ++loadSeq;
      let list;
      try { list = await vfs.list(path); } catch (err) { return err; }
      if (seq !== loadSeq) return null;
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
      if (push && prev && prev !== path) { back.push(prev); fwd.length = 0; }
      leaveStorage();
      return true;
    }

    async function refresh(select) {
      const err = await load(cwd, { select });
      if (err && cwd !== '/') await navigate(parentPath(cwd), { push: false });
    }

    async function goBack() {
      if (!back.length) return;
      const target = back.pop();
      const from = cwd;
      if (await load(target) === null) { fwd.push(from); leaveStorage(); } else back.push(target);
    }
    async function goForward() {
      if (!fwd.length) return;
      const target = fwd.pop();
      const from = cwd;
      if (await load(target) === null) { back.push(from); leaveStorage(); } else fwd.push(target);
    }
    const goUp = () => { if (cwd !== '/') navigate(parentPath(cwd)); };

    // ---------- Actions ----------
    const selectedItems = () => [...selected].map(itemByName).filter(Boolean);

    const selectedZip = () => {
      const [it] = selectedItems();
      return selected.size === 1 && it?.kind === 'file' && isArchive(it.name) ? it : null;
    };
    async function extractSelected(here = false) {
      const it = selectedZip();
      if (!it) return;
      const res = await extractArchive(pathOf(it.name), { here });
      if (res?.name && parentPath(res.dir) === cwd && view === 'files') await refresh(res.name);
    }

    // ---------- Downloading ----------
    const saveBlob = (b, name) => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    };

    const stat = (msg) => dialogs.toast(msg, { danger: /failed/i.test(msg) });

    const download = async () => {
      const ns = selectedItems().filter((it) => it.kind === 'file');
      if (!ns.length) {
        return dialogs.toast('Nothing to save — app shortcuts have no file data.', { danger: true });
      }
      try {
        if (ns.length === 1) {
          stat('Downloading...');
          const blob = await vfs.read(joinPath(cwd, ns[0].name));
          saveBlob(blob, ns[0].name);
          return stat(`Downloaded ${ns[0].name}.`);
        }
        return await downloadzip(ns);
      } catch (e) {
        stat('Download failed: ' + e.message);
      }
    };

    const downloadzip = async (ns = selectedItems().filter((it) => it.kind === 'file')) => {
      if (!ns.length) return;
      stat('Preparing ZIP...');
      const out = {};
      const unique = (name) => {
        let n = name, i = 2;
        while (out[n]) n = name.replace(/(\.[^./]+)?$/, ` (${i++})$1`);
        return n;
      };
      const gather = async (nd, prefix, dir) => {
        if (nd.kind === 'app') return;           // app shortcuts have no file content
        const path = joinPath(dir, nd.name);
        if (nd.kind === 'dir') {
          const base = prefix + nd.name + '/';
          out[base] = new Uint8Array(0);
          for (const k of await vfs.list(path)) await gather(k, base, path);
        } else {
          const blob = await vfs.read(path);
          out[unique(prefix + nd.name)] = new Uint8Array(await blob.arrayBuffer());
        }
      };
      try {
        for (const n of ns) await gather(n, '', cwd);
        saveBlob(buildZip(out), ns.length === 1 ? ns[0].name + '.zip' : 'Export.zip');
        stat('ZIP downloaded.');
      } catch (e) {
        stat('Download failed: ' + e.message);
      }
    };

    // ---------- Clipboard ----------
    const copySelected = () => { if (selected.size) setClipboard('copy', cwd, [...selected]); };
    const cutSelected = () => {
      if (!selected.size) return;
      if (selectedItems().some((it) => it.protected)) return;    // protected entries can't be cut
      setClipboard('cut', cwd, [...selected]);
    };

    async function pasteInto(dir = cwd) {
      if (!getClipboard()) return;
      const res = await paste(dir);
      if (res.errors.length) await dialogs.alert('Paste', res.errors.join('\n'));
      if (dir === cwd && view === 'files') {
        await refresh();
        if (res.done.length) setSelection(res.done.map((d) => d.to), res.done[0].to);
      }
    }
    const paintCut = () => {
      for (const el of elList.children) if (el.dataset.name) el.classList.toggle('cut', isCut(cwd, el.dataset.name));
      updateStatus();
    };

    function openSelected() {
      const [it] = selectedItems();
      if (selected.size === 1 && it) openEntry(it);
    }
    function openEntry(it) {
      if (it.kind === 'dir') navigate(pathOf(it.name));
      else openItem(pathOf(it.name), it.kind, it.name, it.appId);
    }
    async function newEntry(kind) {
      const name = await createEntry(cwd, kind);
      if (name) await refresh(name);
    }
    async function renameSelected() {
      if (selected.size !== 1) return;
      const it = selectedItems()[0];
      if (!it || it.protected) return;
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

    // ---------- Upload ----------
    async function afterUpload(saved) {
      if (!saved.length) return;
      if (await navigate(UPLOADS_DIR)) setSelection(saved.map((f) => f.name), saved[0].name);
    }
    async function uploadFromComputer() {
      const files = await pickFiles();
      if (files.length) await afterUpload((await uploadFiles(files)).saved);
    }

    // ---------- Storage (virtual disk) ----------
    const pct = (a, b) => (b ? Math.min(100, (a / b) * 100) : 0);
    const fmtPct = (v) => (v > 0 && v < 0.1 ? '<0.1' : v.toFixed(v < 10 ? 1 : 0)) + '%';

    function paintDisk() {
      if (!disk) return;
      const usedPct = pct(disk.used, disk.capacity);
      body.querySelector('[data-val="used"]').textContent = formatBytes(disk.used);
      body.querySelector('[data-val="left"]').textContent = formatBytes(disk.free);
      body.querySelector('.fm-meter-fill').style.width = usedPct + '%';
      body.querySelector('.fm-meter').classList.toggle('full', usedPct >= 90);
      elDisk.textContent = `Used ${formatBytes(disk.used)} · ${formatBytes(disk.free)} left`;
    }

    async function paintStoragePanel() {
      if (view !== 'storage' || !disk) return;
      const tab = storageTab;
      elStorage.querySelectorAll('[data-store]').forEach((b) => {
        const on = b.dataset.store === tab;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', String(on));
      });
      const usedPct = pct(disk.used, disk.capacity);
      const freePct = 100 - usedPct;
      let rows = [];
      try { rows = await vfs.breakdown(HOME); } catch { /* home missing: show no breakdown */ }
      if (view !== 'storage' || tab !== storageTab) return;

      const big = tab === 'used' ? formatBytes(disk.used) : formatBytes(disk.free);

      let isPersisted = false;
      if (navigator.storage && navigator.storage.persisted) {
        try { isPersisted = await navigator.storage.persisted(); } catch {}
      }

      let requestedGB = 25;
      try {
        const cfg = JSON.parse(localStorage.getItem('os16.config'));
        if (cfg && cfg.diskLimit) requestedGB = cfg.diskLimit;
      } catch {}

      const browserLimitGB = (disk.capacity / 1024 ** 3).toFixed(1);
      const isCapped = parseFloat(browserLimitGB) < requestedGB;

      const sub = tab === 'used'
        ? `of ${formatBytes(disk.capacity)} virtual disk used (${fmtPct(usedPct)})${isCapped ? ` <br><span style="color:var(--danger-ink);font-size:11px;">(Capped by browser from ${requestedGB} GB)</span>` : ''}`
        : `free of ${formatBytes(disk.capacity)} (${fmtPct(freePct)})${isCapped ? ` <br><span style="color:var(--danger-ink);font-size:11px;">(Capped by browser from ${requestedGB} GB)</span>` : ''}`;

      const fill = tab === 'used' ? usedPct : freePct;
      const warn = usedPct >= 90 ? `<div class="fm-warn">${iconHTML('warning', 14)}<span>The disk is almost full. Delete files to free up space.</span></div>` : '';

      const persistStatus = isPersisted
        ? `<div style="display:flex; align-items:center; gap:8px; font-weight:600; margin-top:12px;">${iconHTML('check', 16)} Persistent Storage Granted</div>
           <p class="fm-note" style="margin-top:4px;">Your data is safe from automatic eviction. The browser will allow you to use as much space as it can spare.</p>`
        : `<div style="display:flex; align-items:center; gap:8px; font-weight:600; margin-top:12px; color:var(--tx-muted);">${iconHTML('warning', 16)} Persistent Storage Not Granted</div>
           <p class="fm-note" style="margin-top:4px;">Without this, the browser may limit your disk size to ~10 GB and clear your files if space gets low.</p>
           <button class="app-btn primary" id="btn-request-persist" style="margin-top:8px;">Request More Space</button>`;

      const kv = `
        <div class="fm-kv">
          <div><span>Total storage used</span><b>${formatBytes(disk.used)}</b></div>
          <div><span>Total storage left</span><b>${formatBytes(disk.free)}</b></div>
          <div><span>Disk size</span><b>${formatBytes(disk.capacity)}</b></div>
          <div><span>Files / folders</span><b>${disk.files} / ${Math.max(0, disk.dirs - 1)}</b></div>
        </div>
        ${persistStatus}`;

      const breakdown = tab === 'used' ? `
        <div class="fm-bd-title">Used by item in Home</div>
        <div class="fm-bd">${rows.length ? rows.map((r) => `
          <button type="button" class="fm-bd-row" data-path="${esc(joinPath(HOME, r.name))}" data-kind="${r.kind}">
            <span class="fm-bd-name">${iconHTML(r.kind === 'dir' ? 'folder' : r.kind === 'app' ? 'grid' : 'file', 14)}<span>${esc(r.name)}</span></span>
            <span class="fm-bd-bar"><span style="width:${pct(r.size, disk.used)}%"></span></span>
            <span class="fm-bd-size">${formatBytes(r.size) || '0 B'}</span>
          </button>`).join('') : '<div class="muted">Nothing stored yet.</div>'}</div>` : `
        <p class="fm-note">Everything you save, create or upload lives on this virtual disk. When it fills up, new files can’t be saved until you delete something.</p>`;

      elStoragePanel.innerHTML = `
        <div class="fm-big">${big}</div>
        <div class="fm-sub">${sub}</div>
        <div class="fm-meter lg${usedPct >= 90 ? ' full' : ''}"><div class="fm-meter-fill" style="width:${fill}%"></div></div>
        ${warn}${kv}${breakdown}`;

      const btnPersist = elStoragePanel.querySelector('#btn-request-persist');
      if (btnPersist) {
        btnPersist.onclick = async () => {
          btnPersist.textContent = 'Requesting...';
          btnPersist.disabled = true;

          const res = await vfs.requestPersist();

          if (res.granted) {
            dialogs.toast('Persistent storage granted! Quota updated.', { danger: false });
            await refreshDisk();
          } else {
            dialogs.alert('Storage Request', 'The browser denied the request for persistent storage. You may need to adjust your browser settings or clear some disk space on your computer.');
            btnPersist.textContent = 'Request More Space';
            btnPersist.disabled = false;
          }
        };
      }
    }

    async function refreshDisk() {
      try { disk = await vfs.usage(); } catch (err) { console.error(err); return; }
      paintDisk();
      paintStoragePanel();
    }

    function showStorage(tab) {
      if (tab) storageTab = tab;
      view = 'storage';
      elArea.hidden = true;
      elStorage.hidden = false;
      syncNav();
      updateStatus();
      refreshDisk();
    }
    function leaveStorage() {
      if (view === 'files') { syncNav(); return; }
      view = 'files';
      elStorage.hidden = true;
      elArea.hidden = false;
      syncNav();
      updateStatus();
    }
    function toggleStorage() { if (view === 'storage') leaveStorage(); else showStorage(); }

    elStorage.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-store]');
      if (tab) { storageTab = tab.dataset.store; syncNav(); paintStoragePanel(); return; }
      const row = e.target.closest('.fm-bd-row');
      if (row && row.dataset.kind === 'dir') navigate(row.dataset.path);
      else if (row) navigate(parentPath(row.dataset.path)).then(() => setSelection([baseName(row.dataset.path)]));
    });
    $('.fm-storage-group').addEventListener('click', (e) => {
      const tab = e.target.closest('.fm-store-tab');
      if (tab) { showStorage(tab.dataset.store); focusApp(); }
    });

    const COMMANDS = {
      back: goBack, fwd: goForward, up: goUp, refresh: () => (view === 'storage' ? refreshDisk() : refresh()),
      newfolder: () => newEntry('dir'), newfile: () => newEntry('file'), view: toggleView,
      upload: uploadFromComputer, download: download, downloadzip: downloadzip,
      storage: toggleStorage, cut: cutSelected, copy: copySelected, paste: () => pasteInto(), extract: () => extractSelected(false)
    };

    // ---------- Pointer & menu events (all delegated) ----------
    elApp.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cmd]');
      if (b && elApp.contains(b)) { COMMANDS[b.dataset.cmd]?.(); focusApp(); }
    });
    elPath.addEventListener('click', (e) => {
      const c = e.target.closest('[data-path]');
      if (c && (c.dataset.path !== cwd || view === 'storage')) navigate(c.dataset.path);
    });
    $('.fm-sidebar').addEventListener('click', (e) => {
      const c = e.target.closest('.sidebar-item[data-path]');
      if (c && (c.dataset.path !== cwd || view === 'storage')) navigate(c.dataset.path);
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
        const sel = selectedItems();
        const one = selected.size === 1;
        const anyProtected = sel.some((it) => it.protected);
        const hasFiles = sel.some((it) => it.kind === 'file');
        const zip = selectedZip();
        const folder = one && sel[0]?.kind === 'dir' ? sel[0] : null;
        showMenu(e.clientX, e.clientY, [
          { label: zip ? 'Extract…' : 'Open', action: openSelected, disabled: !one },
          ...(zip ? [
            { label: `Extract to “${zip.name.replace(/\.zip$/i, '') || 'archive'}/”`, action: () => extractSelected(false) },
            { label: 'Extract Here', action: () => extractSelected(true) }
          ] : []),
          { sep: true },
          { label: 'Save to Device', action: download, disabled: !hasFiles },
          { sep: true },
          { label: 'Cut', action: cutSelected, disabled: anyProtected, hint: 'Ctrl+X' },
          { label: 'Copy', action: copySelected, hint: 'Ctrl+C' },
          ...(folder && getClipboard() ? [{ label: `Paste Into “${folder.name}”`, action: () => pasteInto(pathOf(folder.name)) }] : []),
          { label: 'Paste', action: () => pasteInto(), disabled: !getClipboard(), hint: 'Ctrl+V' },
          { sep: true },
          { label: 'Rename', action: renameSelected, disabled: !one || anyProtected, hint: 'F2' },
          { label: 'Delete', action: deleteSelected, disabled: anyProtected, danger: true, hint: 'Del' }
        ]);
      } else {
        setSelection([]);
        showMenu(e.clientX, e.clientY, [
          { label: 'New Folder', action: () => newEntry('dir') },
          { label: 'New Text File', action: () => newEntry('file') },
          { sep: true },
          { label: 'Paste', action: () => pasteInto(), disabled: !getClipboard(), hint: 'Ctrl+V' },
          { label: 'Upload Files…', action: uploadFromComputer },
          { label: 'Refresh', action: () => refresh(), hint: 'F5' }
        ]);
      }
    });

    // ---------- Marquee selection (with autoscroll) ----------
    let mq = null;
    const autoScroll = { vx: 0, vy: 0, raf: 0, active: false };

    function stopAutoScroll() {
      autoScroll.active = false;
      autoScroll.vx = autoScroll.vy = 0;
      if (autoScroll.raf) { cancelAnimationFrame(autoScroll.raf); autoScroll.raf = 0; }
    }

    function stepAutoScroll() {
      autoScroll.raf = 0;
      if (!mq || !autoScroll.active) return;
      const { vx, vy } = autoScroll;
      if (!vx && !vy) { autoScroll.active = false; return; }
      if (vy) elArea.scrollTop += vy;
      if (vx) elArea.scrollLeft += vx;
      updateMarquee();
      autoScroll.raf = requestAnimationFrame(stepAutoScroll);
    }

    function updateAutoScrollFrom(ev) {
      if (!mq) return;
      const EDGE = 28;
      const MAX = 18;
      const box = elArea.getBoundingClientRect();
      const axis = (pos, lo, hi) => {
        if (pos < lo + EDGE) return -Math.min(1, (lo + EDGE - pos) / EDGE) * MAX;
        if (pos > hi - EDGE) return Math.min(1, (pos - (hi - EDGE)) / EDGE) * MAX;
        return 0;
      };
      autoScroll.vx = axis(ev.clientX, box.left, box.left + elArea.clientWidth);
      autoScroll.vy = axis(ev.clientY, box.top, box.top + elArea.clientHeight);
      if ((autoScroll.vx || autoScroll.vy) && !autoScroll.active) {
        autoScroll.active = true;
        autoScroll.raf = requestAnimationFrame(stepAutoScroll);
      }
      if (!autoScroll.vx && !autoScroll.vy) stopAutoScroll();
    }

    const updateMarquee = () => {
      if (!mq || !mq.ev) return;
      mq.raf = 0;
      const box = elArea.getBoundingClientRect();
      const ox = box.left - elArea.scrollLeft;
      const oy = box.top - elArea.scrollTop;
      const cx = mq.ev.clientX - ox, cy = mq.ev.clientY - oy;
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

    elArea.addEventListener('pointerdown', (e) => {
      focusApp();
      if (e.button !== 0 || e.target.closest('[data-name], .fm-head')) return;
      const box = elArea.getBoundingClientRect();
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
      mq = { sx: e.clientX - ox, sy: e.clientY - oy, rects, base, el, raf: 0, ev: null };
      elArea.setPointerCapture(e.pointerId);
    });

    elArea.addEventListener('pointermove', (e) => {
      if (!mq) return;
      mq.ev = e;
      updateAutoScrollFrom(e);
      if (!mq.raf) mq.raf = requestAnimationFrame(updateMarquee);
    });

    const endMarquee = () => {
      if (!mq) return;
      cancelAnimationFrame(mq.raf);
      stopAutoScroll();
      mq.el.remove();
      mq = null;
    };
    elArea.addEventListener('pointerup', endMarquee);
    elArea.addEventListener('pointercancel', endMarquee);

    // ---------- Drag & drop ----------
    // The drag payload carries `appIds` for any selected app shortcuts. That
    // lets consumers (desktop, other Files windows) tell "this is a shortcut
    // to launch the Calculator" apart from "this is a file called Calculator".
    elList.addEventListener('dragstart', (e) => {
      const row = e.target.closest('[data-name]');
      if (!row) return;
      if (!selected.has(row.dataset.name)) setSelection([row.dataset.name], row.dataset.name);
      const names = [...selected];
      const appIds = {};
      for (const name of names) {
        const it = itemByName(name);
        if (it?.kind === 'app' && it.appId) appIds[name] = it.appId;
      }
      setDragPaths(e, cwd, names, appIds);
    });

    let dropEl = null;
    const setDropEl = (el) => {
      if (dropEl === el) return;
      dropEl?.classList.remove('drop-target');
      dropEl = el;
      el?.classList.add('drop-target');
    };
    const clearDrop = () => { setDropEl(null); elApp.classList.remove('drop-upload'); };

    function dropTarget(e) {
      const row = e.target.closest('.fm-row, .fm-tile');
      if (row) {
        const it = itemByName(row.dataset.name);
        return it?.kind === 'dir' ? { dir: pathOf(it.name), el: row } : { dir: cwd, el: elArea };
      }
      const side = e.target.closest('.sidebar-item[data-path]');
      if (side) return { dir: side.dataset.path, el: side };
      const crumb = e.target.closest('.fm-crumb');
      if (crumb) return { dir: crumb.dataset.path, el: crumb };
      if (e.target.closest('.fm-list-area')) return { dir: cwd, el: elArea };
      return null;
    }

    elApp.addEventListener('dragover', (e) => {
      if (hasFiles(e)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDropEl(null);
        elApp.classList.add('drop-upload');
      } else if (hasPaths(e)) {
        const t = dropTarget(e);
        if (!t) { setDropEl(null); return; }
        e.preventDefault();
        e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
        setDropEl(t.el);
      }
    });
    elApp.addEventListener('dragleave', (e) => { if (!elApp.contains(e.relatedTarget)) clearDrop(); });
    window.addEventListener('dragend', clearDrop);
    elApp.addEventListener('drop', async (e) => {
      const paths = hasPaths(e), files = hasFiles(e);
      if (!paths && !files) return;
      e.preventDefault();
      const target = paths ? dropTarget(e) : null;
      const data = paths ? readDragPaths(e) : null;
      const ext = !data && files ? filesFromDrop(e) : null;
      const copy = e.ctrlKey;
      clearDrop();
      if (!target && data) return;

      try {
        if (data && target) {
          const errors = [];

          // Split the payload: names that exist at the source become file/dir
          // transfers; names without a source path but with an appId become
          // new app shortcuts created in the target folder.
          const fileNames = [];
          const appCreates = [];
          for (const name of data.names) {
            const hasSrc = data.dir ? await vfs.exists(joinPath(data.dir, name)) : false;
            if (hasSrc) {
              fileNames.push(name);
            } else if (data.appIds?.[name]) {
              appCreates.push({ name, appId: data.appIds[name] });
            } else {
              errors.push(`${name}: source not found`);
            }
          }

          const filteredFileNames = fileNames.filter((n) => joinPath(data.dir, n) !== target.dir);
          if (filteredFileNames.length) {
            const res = await transferInto(data.dir, filteredFileNames, target.dir, { copy });
            errors.push(...res.errors);
          }

          for (const { name, appId } of appCreates) {
            try {
              await vfs.writeApp(joinPath(target.dir, name), appId);
            } catch (err) {
              errors.push(`${name}: ${err.message.replace(/^E[A-Z]+: /, '')}`);
            }
          }

          if (errors.length) dialogs.alert('Drop', errors.join('\n'));
          else if (appCreates.length) {
            dialogs.toast(`Added ${appCreates.length} app${appCreates.length === 1 ? '' : 's'}`);
          }
        } else if (ext) {
          await afterUpload((await uploadFiles(ext.files, { skippedFolders: ext.skippedFolders })).saved);
        }
      } catch (err) {
        console.error(err);
        dialogs.alert('Error', err.message);
      }
    });

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
      if (view === 'storage') {
        if ((e.key === 'Escape' || e.key === 'Backspace') && e.target === elApp) { leaveStorage(); e.preventDefault(); }
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      const grid = viewMode === 'grid';
      let handled = true;
      if (e.altKey && e.key === 'ArrowLeft') goBack();
      else if (e.altKey && e.key === 'ArrowRight') goForward();
      else if (e.altKey && e.key === 'ArrowUp') goUp();
      else if (mod && e.key.toLowerCase() === 'a') setSelection(items.map((i) => i.name), anchor);
      else if (mod && e.key.toLowerCase() === 'c') copySelected();
      else if (mod && e.key.toLowerCase() === 'x') cutSelected();
      else if (mod && e.key.toLowerCase() === 'v') pasteInto();
      else if (mod && e.key.toLowerCase() === 's') download();
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
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => refresh(), 20);
    });
    const unsubClip = onClipboardChange(paintCut);
    let diskTimer = 0;
    const unsubDisk = vfs.on('*', () => { clearTimeout(diskTimer); diskTimer = setTimeout(refreshDisk, 250); });
    ctx.onCleanup(() => {
      unsub(); unsubDisk(); unsubClip();
      clearTimeout(refreshTimer); clearTimeout(diskTimer);
      window.removeEventListener('dragend', clearDrop);
      endMarquee();
    });
    ctx.onFocus(focusApp);

    refreshDisk();
    return navigate(args.path || HOME).then(async (ok) => {
      if (!ok) await navigate('/');
      focusApp();
    });
  }
};
