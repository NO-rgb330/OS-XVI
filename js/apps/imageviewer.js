/* ============================================================
   Image Viewer — a standalone app.
   It can open images by itself (virtual-disk picker, upload from the
   computer, or drag & drop), browses the other images in the same
   folder, and stays in sync when that folder changes.

   View model: the <img> is laid out at its natural size and positioned
   purely by a transform:  translate(centre) · rotate · scale.
   State is { scale, cx, cy, rot } where (cx, cy) is the image centre
   in stage pixels, so zooming around a point is simple algebra.

   Built to stay smooth while files are still being uploaded:
     · Decoded images live in a small LRU cache and the neighbours of the
       current picture are decoded ahead of time, so ←/→ is instant.
     · Holding an arrow key skips the pictures in between: only the one
       you stop on is loaded, and a cached thumbnail stands in meanwhile.
     · The grid uses real thumbnails (core/thumbs.js) instead of decoding
       full-size photos, only for tiles near the viewport.
     · Folder changes are throttled and applied incrementally, so a flood
       of uploads never rebuilds the grid or reloads the current picture.
     · Pan / zoom writes are batched to one per animation frame.
   ============================================================ */

import * as vfs from '../core/vfs.js';
import * as dialogs from '../core/dialogs.js';
import * as thumbs from '../core/thumbs.js';
import { iconHTML } from '../core/icons.js';
import { esc, joinPath, parentPath, baseName, formatBytes, mimeOf } from '../core/util.js';
import { IMAGE, isImage } from '../core/files.js';
import { hasPaths, hasFiles, readDragPaths, filesFromDrop } from '../core/dnd.js';
import { pickFiles, uploadFiles } from '../core/upload.js';

const MIN_SCALE = 0.02;
const MAX_SCALE = 40;
const ZOOM_STEP = 1.25;
const PICTURES = '/home/user/Pictures';

const CACHE_MAX = 7;                                   // decoded pictures kept ready
const CACHE_BYTES = Math.min(384, Math.max(128, (navigator.deviceMemory || 4) * 48)) * 1024 * 1024;
const PRELOAD_MAX_FILE = 32 * 1024 * 1024;             // don't read-ahead huge files
const RAPID_MS = 220;                                  // steps closer together than this count as "scrubbing"
const SETTLE_MS = 90;                                  // while scrubbing, load once the user pauses this long
const PLACEHOLDER_MS = 70;                             // show a thumbnail if the full image takes longer than this
const RESCAN_MS = 350;                                 // at most ~3 folder refreshes per second
const NOT_AN_IMAGE = 'This file isn’t a valid image, or its format isn’t supported by your browser.';
const VIEW_CMDS = ['zoomin', 'zoomout', 'fit', 'actual', 'rotl', 'rotr'];

const idle = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 500 }) : setTimeout(fn, 30));

const btn = (cmd, title, icon, label = '') =>
  `<button type="button" class="toolbar-btn" data-cmd="${cmd}" title="${esc(title)}" aria-label="${esc(title)}">${iconHTML(icon, 14)}${label ? `<span>${label}</span>` : ''}</button>`;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const errText = (err) => String(err?.message || err).replace(/^E[A-Z]+: /, '');

export const imageViewerApp = {
  id: 'imageviewer',
  name: 'Image Viewer',
  icon: 'gallery',
  defaultSize: [820, 580],

  async launch(body, args, ctx) {
    // ---------- State ----------
    let dir = null;                 // folder being browsed
    let files = [];                 // images in `dir`: { id, key, name, path, size, mtime, node }
    let index = -1;                 // current image in `files`
    let nat = { w: 0, h: 0 };       // natural size of what is on screen
    let scale = 1, cx = 0, cy = 0, rot = 0;
    let fitMode = true;             // true while the image is auto-fitted to the stage
    let hasImage = false;           // an image (or its stand-in) is currently displayed
    let mode = 'single';            // 'single' | 'grid'
    let loadSeq = 0;                // discards results of superseded loads
    let shownKey = null;            // cache key of the full image on screen
    let placeholderKey = null;      // key of the thumbnail stand-in on screen, if any
    let travel = 1;                 // direction of the last step (+1 / -1), decides what to read ahead
    let lastNav = 0;
    let loadTimer = 0, phTimer = 0, preloadGen = 0;
    let rescanTimer = 0, rescanRunning = false, rescanDirty = false, lastRescan = 0;

    body.innerHTML = `
      <div class="iv-app" tabindex="0">
        <div class="app-toolbar iv-toolbar">
          ${btn('open', 'Open image… (O)', 'folder', 'Open')}
          ${btn('upload', 'Upload from your computer (saved to UPLOADS)', 'upload')}
          <div class="toolbar-sep"></div>
          ${btn('prev', 'Previous image (←)', 'chevron-left')}
          ${btn('next', 'Next image (→)', 'chevron-right')}
          <div class="toolbar-sep"></div>
          ${btn('zoomout', 'Zoom out (−)', 'zoom-out')}
          ${btn('zoomin', 'Zoom in (+)', 'zoom-in')}
          ${btn('fit', 'Fit to window (0)', 'fit')}
          ${btn('actual', 'Actual size (1)', 'max', '1:1')}
          <div class="toolbar-sep"></div>
          ${btn('rotl', 'Rotate left (Shift+R)', 'rotate-left')}
          ${btn('rotr', 'Rotate right (R)', 'rotate-right')}
          <div class="toolbar-sep"></div>
          ${btn('grid', 'Thumbnails (G)', 'grid')}
          ${btn('fs', 'Full screen (F)', 'fullscreen')}
        </div>
        <div class="iv-main">
          <div class="iv-stage" hidden>
            <img class="iv-img" alt="" draggable="false" hidden>
            <button type="button" class="iv-nav iv-nav-prev" data-cmd="prev" title="Previous" aria-label="Previous image">${iconHTML('chevron-left', 22)}</button>
            <button type="button" class="iv-nav iv-nav-next" data-cmd="next" title="Next" aria-label="Next image">${iconHTML('chevron-right', 22)}</button>
            <div class="iv-msg" hidden></div>
          </div>
          <div class="iv-grid" hidden></div>
          <div class="iv-empty app-empty">
            ${iconHTML('gallery', 40)}
            <div>No image open</div>
            <div class="iv-empty-actions">
              <button type="button" class="app-btn primary" data-cmd="open">Open Image…</button>
              <button type="button" class="app-btn" data-cmd="upload">Upload from computer…</button>
            </div>
            <div class="muted">…or drag an image here</div>
          </div>
          <div class="iv-droptip" hidden>Drop to open</div>
        </div>
        <div class="app-statusbar">
          <div class="sb-cell grow iv-s-name">No image open</div>
          <div class="sb-cell iv-s-dim"></div>
          <div class="sb-cell iv-s-size"></div>
          <div class="sb-cell iv-s-pos"></div>
          <div class="sb-cell iv-s-zoom"></div>
        </div>
      </div>`;

    const $ = (s) => body.querySelector(s);
    const elApp = $('.iv-app');
    const stage = $('.iv-stage');
    const blankImg = $('.iv-img');          // shown when there is nothing to show; real pictures swap in and out of its place
    let img = blankImg;                     // the <img> currently in the stage
    const msg = $('.iv-msg');
    const grid = $('.iv-grid');
    const empty = $('.iv-empty');
    const droptip = $('.iv-droptip');
    const sName = $('.iv-s-name'), sDim = $('.iv-s-dim'), sSize = $('.iv-s-size'), sPos = $('.iv-s-pos'), sZoom = $('.iv-s-zoom');
    const cmdBtns = {};
    body.querySelectorAll('.iv-toolbar [data-cmd]').forEach((b) => { cmdBtns[b.dataset.cmd] = b; });
    const navBtns = [...body.querySelectorAll('.iv-nav')];
    const focusApp = () => elApp.focus({ preventScroll: true });
    let zoomText = '';

    // ---------- Geometry ----------
    const quarter = () => rot % 180 !== 0;
    const stageSize = () => ({ w: stage.clientWidth, h: stage.clientHeight });

    function shownSize() {
      const w = (quarter() ? nat.h : nat.w) * scale;
      const h = (quarter() ? nat.w : nat.h) * scale;
      return { w, h };
    }

    /** Scale at which the (rotated) image exactly fits the stage. */
    function fitScale() {
      const s = stageSize();
      const bw = quarter() ? nat.h : nat.w, bh = quarter() ? nat.w : nat.h;
      if (!bw || !bh || !s.w || !s.h) return 1;
      return Math.min(s.w / bw, s.h / bh);
    }

    function clampView() {
      const s = stageSize(), b = shownSize();
      // Centre when smaller than the stage; otherwise stop at the edges.
      cx = b.w <= s.w ? s.w / 2 : Math.min(b.w / 2, Math.max(s.w - b.w / 2, cx));
      cy = b.h <= s.h ? s.h / 2 : Math.min(b.h / 2, Math.max(s.h - b.h / 2, cy));
    }

    let paintRaf = 0;
    function paint() {
      paintRaf = 0;
      if (!hasImage) return;
      img.style.transform = `translate(${cx - nat.w / 2}px, ${cy - nat.h / 2}px) rotate(${rot}deg) scale(${scale})`;
      const z = Math.round(scale * 100) + '%';
      if (z !== zoomText) sZoom.textContent = zoomText = z;
    }

    /** Clamp now; paint now (`sync`) or on the next frame (pointer / wheel bursts). */
    function applyTransform(sync = true) {
      if (!hasImage) return;
      clampView();
      if (sync) {
        if (paintRaf) { cancelAnimationFrame(paintRaf); paintRaf = 0; }
        paint();
      } else if (!paintRaf) {
        paintRaf = requestAnimationFrame(paint);
      }
    }

    function setFit() {
      const s = stageSize();
      fitMode = true;
      scale = Math.min(fitScale(), 1);   // never blow small images up automatically
      cx = s.w / 2;
      cy = s.h / 2;
      applyTransform();
    }

    /** Zoom to `next`, keeping the stage point (px, py) fixed. */
    function zoomTo(next, px, py, sync = true) {
      if (!hasImage) return;
      const s = stageSize();
      px ??= s.w / 2;
      py ??= s.h / 2;
      next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next));
      const k = next / scale;
      cx = px - (px - cx) * k;
      cy = py - (py - cy) * k;
      scale = next;
      fitMode = false;
      applyTransform(sync);
    }

    function rotate(deg) {
      if (!hasImage) return;
      rot = (((rot + deg) % 360) + 360) % 360;
      if (fitMode) setFit(); else applyTransform();
    }

    function toggleZoom(px, py) {
      if (!hasImage) return;
      if (fitMode) zoomTo(Math.min(fitScale(), 1) < 1 ? 1 : 2, px, py);
      else setFit();
    }

    // ---------- Chrome (what's visible / enabled) ----------
    function updateChrome() {
      const any = files.length > 0;
      const showEmpty = !any && !hasImage;
      empty.hidden = !showEmpty;
      stage.hidden = showEmpty || mode === 'grid';
      grid.hidden = !(any && mode === 'grid');

      const multi = files.length > 1;
      cmdBtns.prev.disabled = cmdBtns.next.disabled = !multi;
      for (const b of navBtns) b.hidden = !multi;
      const canView = hasImage && mode === 'single';
      for (const c of VIEW_CMDS) cmdBtns[c].disabled = !canView;
      cmdBtns.grid.disabled = !any;
      cmdBtns.grid.setAttribute('aria-pressed', String(mode === 'grid'));
      updateStatus();
    }

    function updateStatus() {
      const f = files[index];
      sName.textContent = f ? f.name : 'No image open';
      sDim.textContent = f && hasImage ? `${nat.w} × ${nat.h}` : '';
      sSize.textContent = f ? formatBytes(f.size) : '';
      sPos.textContent = f && files.length ? `${index + 1} / ${files.length}` : '';
      if (!hasImage) sZoom.textContent = zoomText = '';
      ctx.setTitle(f ? `${f.name} — Image Viewer` : 'Image Viewer');
    }

    function showMessage(text) {
      msg.textContent = text || '';
      msg.hidden = !text;
    }

    // ---------- Decoded-image cache + read-ahead ----------
    // key -> { key, url, img, w, h, bytes, dead, promise }. Insertion order is LRU order.
    const cache = new Map();

    function dispose(e) {
      e.dead = true;
      if (e.url) { URL.revokeObjectURL(e.url); e.url = ''; }
    }

    /** Keeps the cache within its count and memory budget; never drops what's on screen or current. */
    function trim() {
      let bytes = 0;
      for (const e of cache.values()) bytes += e.bytes;
      const current = files[index]?.key;
      for (const [k, e] of cache) {
        if (cache.size <= CACHE_MAX && bytes <= CACHE_BYTES) break;
        if (!e.img || k === shownKey || k === current) continue;
        cache.delete(k);
        bytes -= e.bytes;
        dispose(e);
      }
    }

    function pruneCache() {
      const live = new Set(files.map((f) => f.key));
      for (const [k, e] of cache) {
        if (live.has(k) || k === shownKey || !e.img) continue;
        cache.delete(k);
        dispose(e);
      }
    }

    /** Reads + decodes `f` once; later calls share the work (or the finished result). */
    function fetchFull(f) {
      const known = cache.get(f.key);
      if (known) { cache.delete(f.key); cache.set(f.key, known); return known.promise; }

      const e = { key: f.key, url: '', img: null, w: 0, h: 0, bytes: 0, dead: false, promise: null };
      e.promise = (async () => {
        const data = await vfs.readNode(f.node);
        if (e.dead) throw new Error('closed');
        // Blobs from OPFS have no MIME type; without one SVGs (and some others) won't render.
        e.url = URL.createObjectURL(new Blob([data], { type: mimeOf(f.name) }));
        const im = new Image();
        im.className = 'iv-img';
        im.alt = '';
        im.draggable = false;
        im.decoding = 'async';
        im.src = e.url;
        try { await im.decode(); } catch { throw new Error(NOT_AN_IMAGE); }
        e.w = im.naturalWidth || 512;
        e.h = im.naturalHeight || 512;
        im.style.width = e.w + 'px';
        im.style.height = e.h + 'px';
        e.bytes = e.w * e.h * 4;
        e.img = im;
        trim();
        return e;
      })();
      e.promise.catch(() => {
        dispose(e);
        if (cache.get(f.key) === e) cache.delete(f.key);
      });
      cache.set(f.key, e);
      return e.promise;
    }

    /** Decodes the pictures the user is most likely to see next, one at a time, when the browser is idle. */
    function schedulePreload() {
      const gen = ++preloadGen;
      const n = files.length;
      if (n < 2) return;
      const order = [travel, 2 * travel, -travel]
        .map((o) => (((index + o) % n) + n) % n)
        .filter((j, k, a) => j !== index && a.indexOf(j) === k);
      idle(async () => {
        for (const j of order) {
          if (gen !== preloadGen) return;
          const f = files[j];
          if (!f || f.size > PRELOAD_MAX_FILE || cache.get(f.key)?.img) continue;
          try { await fetchFull(f); } catch { /* reported when the user actually gets there */ }
        }
      });
    }

    // ---------- Showing an image ----------
    function setImg(el) {
      if (img === el) return;
      img.replaceWith(el);
      img = el;
    }

    function clearImage() {
      loadSeq++;
      clearTimeout(loadTimer);
      clearTimeout(phTimer);
      hasImage = false;
      shownKey = placeholderKey = null;
      setImg(blankImg);
      blankImg.hidden = true;
      blankImg.removeAttribute('src');
      stage.classList.remove('loading');
      showMessage('');
    }

    /** Puts a decoded cache entry on screen. */
    function present(e) {
      clearTimeout(phTimer);
      // If its thumbnail stand-in was already on screen at the same size, keep the user's zoom / pan.
      const keep = hasImage && placeholderKey === e.key && nat.w === e.w && nat.h === e.h;
      nat = { w: e.w, h: e.h };
      setImg(e.img);
      img.hidden = false;
      hasImage = true;
      shownKey = e.key;
      placeholderKey = null;
      if (!keep) rot = 0;
      showMessage('');
      stage.classList.remove('loading');
      updateChrome();
      if (keep && !fitMode) applyTransform(); else setFit();
    }

    /** Shows the cached thumbnail, scaled up, while the real image is still being read. */
    async function showPlaceholder(f, ph, seq) {
      const el = new Image();
      el.className = 'iv-img iv-ph';
      el.alt = '';
      el.draggable = false;
      el.src = ph.url;
      try { await el.decode(); } catch { return; }
      if (seq !== loadSeq || shownKey === f.key) return;     // superseded, or the real image already arrived
      nat = { w: ph.ow, h: ph.oh };
      el.style.width = nat.w + 'px';
      el.style.height = nat.h + 'px';
      setImg(el);
      hasImage = true;
      shownKey = null;
      placeholderKey = f.key;
      rot = 0;
      showMessage('');
      updateChrome();
      setFit();
    }

    async function loadFull(f, seq) {
      try {
        const e = await fetchFull(f);
        if (seq !== loadSeq) return;
        present(e);
        afterShow(f, e);
      } catch (err) {
        if (seq !== loadSeq) return;
        clearTimeout(phTimer);
        hasImage = false;
        shownKey = placeholderKey = null;
        setImg(blankImg);
        blankImg.hidden = true;
        blankImg.removeAttribute('src');
        stage.classList.remove('loading');
        showMessage(`Can’t open “${f.name}”.\n${errText(err)}`);
        updateChrome();
      }
    }

    function afterShow(f, e) {
      schedulePreload();
      // Give the grid / scrubbing a thumbnail for this picture without any extra decoding.
      idle(() => { if (!e.dead && e.img) thumbs.adopt(f, e.img, e.w, e.h); });
    }

    /**
     * Navigate to files[i]. A cached picture appears immediately. Otherwise the
     * status bar updates at once, a thumbnail (if we have one) stands in, and
     * the real read + decode starts — straight away for a single step, or once
     * the user stops pressing keys while scrubbing.
     */
    function showIndex(i, d = 0) {
      if (i < 0 || i >= files.length) return Promise.resolve();
      const f = files[i];
      const seq = ++loadSeq;
      clearTimeout(loadTimer);
      clearTimeout(phTimer);
      index = i;
      if (d) travel = d;
      const now = performance.now();
      const rapid = now - lastNav < RAPID_MS;
      lastNav = now;

      const hit = cache.get(f.key);
      if (hit?.img) {
        cache.delete(f.key); cache.set(f.key, hit);
        present(hit);
        afterShow(f, hit);
        return Promise.resolve();
      }

      showMessage('');
      stage.classList.add('loading');
      updateChrome();
      const ph = thumbs.peek(f.key);
      if (ph?.ow) phTimer = setTimeout(() => showPlaceholder(f, ph, seq), rapid ? 0 : PLACEHOLDER_MS);
      if (rapid) {
        loadTimer = setTimeout(() => loadFull(f, seq), SETTLE_MS);
        return Promise.resolve();
      }
      return loadFull(f, seq);
    }

    // ---------- Folder scanning ----------
    function scanDir(d) {
      return vfs.list(d).then((items) => items
        .filter((it) => it.kind === 'file' && isImage(it.name))
        .map((it) => ({
          id: it.id,
          key: `${it.id}:${it.size || 0}:${it.mtime || 0}`,
          name: it.name,
          path: joinPath(d, it.name),
          size: it.size || 0,
          mtime: it.mtime || 0,
          node: it
        })));
    }

    const sameList = (a, b) => a.length === b.length && a.every((f, i) => f.key === b[i].key && f.name === b[i].name);

    async function openPath(path) {
      const d = parentPath(path), name = baseName(path);
      if (!isImage(name)) { dialogs.toast(`“${name}” isn’t an image file.`, { danger: true }); return; }
      try {
        const list = await scanDir(d);
        const i = list.findIndex((f) => f.name === name);
        if (i < 0) throw new Error('ENOENT: ' + path);
        dir = d;
        files = list;
        if (mode === 'grid') mode = 'single';
        stopGrid();
        pruneCache();
        updateChrome();
        await showIndex(i);
        focusApp();
      } catch (err) {
        dialogs.alert('Image Viewer', `Could not open “${name}”: ${errText(err)}`);
      }
    }

    /** Folder changed on disk: refresh the list, follow the current image, drop to a neighbour if it was deleted. */
    async function rescan() {
      if (!dir) return;
      let next;
      try { next = await scanDir(dir); } catch { return; }
      if (sameList(files, next)) return;                    // some other kind of file changed

      const prev = files[index];
      files = next;
      const i = prev ? files.findIndex((f) => f.id === prev.id) : -1;
      pruneCache();
      if (i >= 0) {
        index = i;
        updateChrome();
        if (mode === 'grid') syncGrid();
        if (files[i].key !== prev.key) await showIndex(i);  // the picture itself was replaced
      } else if (files.length) {
        if (mode === 'grid') syncGrid();
        await showIndex(Math.min(Math.max(index, 0), files.length - 1));
      } else {
        index = -1;
        clearImage();
        updateChrome();
        if (mode === 'grid') syncGrid();
      }
    }

    /**
     * Uploads fire a change event per file. Refresh at most every RESCAN_MS
     * (never starved by a steady stream of events) and never run two at once.
     */
    function queueRescan() {
      if (rescanTimer) return;
      rescanTimer = setTimeout(runRescan, Math.max(60, RESCAN_MS - (performance.now() - lastRescan)));
    }
    async function runRescan() {
      rescanTimer = 0;
      if (rescanRunning) { rescanDirty = true; return; }
      rescanRunning = true;
      try { await rescan(); }
      finally {
        rescanRunning = false;
        lastRescan = performance.now();
        if (rescanDirty) { rescanDirty = false; queueRescan(); }
      }
    }

    const step = (d) => { if (files.length > 1) showIndex((index + d + files.length) % files.length, d); };
    const go = (i) => { if (files.length) showIndex(Math.max(0, Math.min(files.length - 1, i))); };

    // ---------- Thumbnail grid ----------
    // One <button> per image, kept across folder changes and reordered in place, so
    // new uploads appear without reloading any thumbnail that is already showing.
    const tiles = new Map();                 // file id -> <button>
    let tileObserver = null;
    const tileTemplate = document.createElement('template');
    tileTemplate.innerHTML = '<button type="button" class="iv-thumb"><div class="iv-thumb-img"></div><span></span></button>';

    function makeTile() {
      const el = tileTemplate.content.firstElementChild.cloneNode(true);
      el._i = -1; el._key = ''; el._name = null; el._cur = false;
      el._img = null; el._vis = false; el._pending = false; el._failed = false;
      return el;
    }

    function dropTileImage(el) {
      if (el._pending) { thumbs.cancel(el._key); el._pending = false; }
      if (el._img) { el.firstElementChild.replaceChildren(); el._img = null; }
    }

    function attachTileImage(el, entry) {
      const im = new Image();
      im.alt = '';
      im.decoding = 'async';
      im.draggable = false;
      im.onerror = () => { el._failed = true; el._img = null; el.firstElementChild.textContent = '?'; };
      im.src = entry.url;
      el.firstElementChild.replaceChildren(im);
      el._img = im;
    }

    function loadTile(el) {
      const f = files[el._i];
      if (!f || el._img || el._pending || el._failed) return;
      const hit = thumbs.peek(f.key);
      if (hit) { attachTileImage(el, hit); return; }
      const key = f.key;
      el._pending = true;
      thumbs.request(f).then((entry) => {
        if (el._key !== key) return;
        el._pending = false;
        if (entry === undefined) return;                    // cancelled: it left the viewport
        if (entry === null) { el._failed = true; el.firstElementChild.textContent = '?'; return; }
        if (el._vis && el.isConnected) attachTileImage(el, entry);
      });
    }

    function unloadTile(el) {
      el._vis = false;
      dropTileImage(el);                    // far off-screen: free the decoded bitmap, keep the cheap cached blob
    }

    function updateTile(el, f, i) {
      el._i = i;
      if (el._name !== f.name) { el._name = f.name; el.title = f.name; el.lastElementChild.textContent = f.name; }
      const cur = i === index;
      if (el._cur !== cur) { el._cur = cur; el.classList.toggle('current', cur); }
      if (el._key !== f.key) {              // new tile, or the picture was replaced
        dropTileImage(el);
        el._failed = false;
        el.firstElementChild.replaceChildren();
        el._key = f.key;
        if (el._vis) loadTile(el);
      }
    }

    /** Brings the grid in line with `files` touching as few DOM nodes as possible. */
    function syncGrid() {
      if (mode !== 'grid' || !tileObserver) return;
      const seen = new Set();
      let ref = grid.firstElementChild;
      files.forEach((f, i) => {
        let el = tiles.get(f.id);
        if (!el) {
          el = makeTile();
          tiles.set(f.id, el);
          updateTile(el, f, i);
          tileObserver.observe(el);
        } else {
          updateTile(el, f, i);
        }
        seen.add(f.id);
        if (el === ref) ref = ref.nextElementSibling;
        else grid.insertBefore(el, ref);
      });
      for (const [id, el] of tiles) {
        if (seen.has(id)) continue;
        dropTileImage(el);
        tileObserver.unobserve(el);
        el.remove();
        tiles.delete(id);
      }
    }

    function stopGrid() {
      tileObserver?.disconnect();
      tileObserver = null;
      for (const el of tiles.values()) dropTileImage(el);
      tiles.clear();
      grid.replaceChildren();
    }

    function enterGrid() {
      stopGrid();
      // Only tiles within ~500 px of the viewport get a thumbnail; the rest cost nothing.
      tileObserver = new IntersectionObserver((entries) => {
        for (const en of entries) {
          const el = en.target;
          if (en.isIntersecting) { el._vis = true; loadTile(el); }
          else unloadTile(el);
        }
      }, { root: grid, rootMargin: '500px 0px' });
      syncGrid();
      const cur = tiles.get(files[index]?.id);
      cur?.scrollIntoView({ block: 'nearest' });
      cur?.focus({ preventScroll: true });
    }

    function setMode(next) {
      if (next === 'grid' && !files.length) return;
      mode = next;
      if (mode === 'grid') { updateChrome(); enterGrid(); }
      else { stopGrid(); updateChrome(); if (hasImage) (fitMode ? setFit : applyTransform)(); focusApp(); }
    }

    grid.addEventListener('click', (e) => {
      const t = e.target.closest('.iv-thumb');
      if (!t) return;
      const i = t._i;
      setMode('single');
      showIndex(i);
    });

    // ---------- Open / upload ----------
    const exitFs = () => { if (document.fullscreenElement === elApp) Promise.resolve(document.exitFullscreen?.()).catch(() => {}); };

    async function openDialog() {
      exitFs();
      const path = await dialogs.filePicker('Open Image', 'open', dir || PICTURES, '', IMAGE);
      if (path) await openPath(path);
    }

    /** Uploads files and opens the first image the moment it lands — the rest keep uploading behind it. */
    async function ingest(list, extra = {}) {
      let opened = false;
      const { saved } = await uploadFiles(list, {
        ...extra,
        onSaved: (f) => { if (!opened && isImage(f.name)) { opened = true; openPath(f.path); } }
      });
      if (!opened && saved.length) dialogs.toast('None of those files are images.', { danger: true });
    }

    async function uploadAndOpen() {
      exitFs();
      const picked = await pickFiles({ accept: 'image/*' });
      if (picked.length) await ingest(picked);
    }

    // ---------- Commands ----------
    function toggleFullscreen() {
      if (document.fullscreenElement === elApp) exitFs();
      else Promise.resolve(elApp.requestFullscreen?.()).catch(() => dialogs.toast('Full screen isn’t available here.'));
    }

    const COMMANDS = {
      open: openDialog, upload: uploadAndOpen,
      prev: () => step(-1), next: () => step(1),
      zoomin: () => zoomTo(scale * ZOOM_STEP), zoomout: () => zoomTo(scale / ZOOM_STEP),
      fit: () => setFit(), actual: () => zoomTo(1),
      rotl: () => rotate(-90), rotr: () => rotate(90),
      grid: () => setMode(mode === 'grid' ? 'single' : 'grid'),
      fs: toggleFullscreen
    };

    elApp.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cmd]');
      if (b) { COMMANDS[b.dataset.cmd]?.(); if (mode === 'single') focusApp(); }
    });

    const tileList = () => [...grid.children];
    const gridColumns = () => {
      const t = tileList();
      let n = 1;
      while (t.length && n < t.length && t[n].offsetTop === t[0].offsetTop) n++;
      return n;
    };
    function focusThumb(delta, absolute = false) {
      const t = tileList();
      if (!t.length) return;
      const cur = t.indexOf(document.activeElement.closest?.('.iv-thumb'));
      const from = cur >= 0 ? cur : Math.max(0, index);
      const next = Math.max(0, Math.min(t.length - 1, absolute ? delta : from + delta));
      t[next].focus({ preventScroll: true });
      t[next].scrollIntoView({ block: 'nearest' });
    }

    elApp.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (mode === 'grid') {                 // arrows move between thumbnails; Enter/Space open natively
        const moves = { ArrowLeft: () => focusThumb(-1), ArrowRight: () => focusThumb(1),
          ArrowUp: () => focusThumb(-gridColumns()), ArrowDown: () => focusThumb(gridColumns()),
          Home: () => focusThumb(0, true), End: () => focusThumb(files.length - 1, true) };
        if (moves[e.key]) { moves[e.key](); e.preventDefault(); return; }
      }
      let handled = true;
      switch (e.key) {
        case 'ArrowLeft': case 'PageUp': if (mode === 'single') step(-1); else handled = false; break;
        case 'ArrowRight': case 'PageDown': if (mode === 'single') step(1); else handled = false; break;
        case 'Home': go(0); break;
        case 'End': go(files.length - 1); break;
        case '+': case '=': zoomTo(scale * ZOOM_STEP); break;
        case '-': case '_': zoomTo(scale / ZOOM_STEP); break;
        case '0': setFit(); break;
        case '1': zoomTo(1); break;
        case 'r': case 'R': rotate(e.shiftKey ? -90 : 90); break;
        case 'g': case 'G': setMode(mode === 'grid' ? 'single' : 'grid'); break;
        case 'f': case 'F': toggleFullscreen(); break;
        case 'o': case 'O': openDialog(); break;
        case 'Escape': if (mode === 'grid') setMode('single'); else handled = false; break;
        default: handled = false;
      }
      if (handled) e.preventDefault();
    });

    // ---------- Pointer: pan, pinch, wheel, double-click ----------
    const pointers = new Map();
    let pan = null;
    let pinch = null;
    const stagePoint = (clientX, clientY) => {
      const r = stage.getBoundingClientRect();
      return { x: clientX - r.left, y: clientY - r.top };
    };

    stage.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.iv-nav') || !hasImage) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      try { stage.setPointerCapture(e.pointerId); } catch { /* pointer gone */ }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        pan = { x: e.clientX, y: e.clientY, cx, cy };
        pinch = null;
        stage.classList.add('panning');
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pan = null;
        pinch = { d: dist(a, b) || 1, scale };
      }
    });

    stage.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const m = stagePoint((a.x + b.x) / 2, (a.y + b.y) / 2);
        zoomTo(pinch.scale * (dist(a, b) / pinch.d), m.x, m.y, false);
      } else if (pan) {
        cx = pan.cx + (e.clientX - pan.x);
        cy = pan.cy + (e.clientY - pan.y);
        applyTransform(false);
      }
    });

    const endPointer = (e) => {
      if (!pointers.delete(e.pointerId)) return;
      pinch = null;
      if (pointers.size === 1) {            // one finger left after a pinch: carry on panning with it
        const [p] = [...pointers.values()];
        pan = { x: p.x, y: p.y, cx, cy };
      } else if (!pointers.size) {
        pan = null;
        stage.classList.remove('panning');
      }
    };
    stage.addEventListener('pointerup', endPointer);
    stage.addEventListener('pointercancel', endPointer);

    stage.addEventListener('wheel', (e) => {
      if (!hasImage) return;
      e.preventDefault();
      let d = e.deltaY;
      if (e.deltaMode === 1) d *= 16;
      else if (e.deltaMode === 2) d *= stage.clientHeight;
      const p = stagePoint(e.clientX, e.clientY);
      zoomTo(scale * Math.exp(-d * (e.ctrlKey ? 0.01 : 0.0015)), p.x, p.y, false);
    }, { passive: false });

    stage.addEventListener('dblclick', (e) => {
      if (e.target.closest('.iv-nav')) return;
      const p = stagePoint(e.clientX, e.clientY);
      toggleZoom(p.x, p.y);
    });

    // Re-fit when the window (or fullscreen state) changes the stage size.
    const ro = new ResizeObserver(() => {
      if (!hasImage || mode !== 'single') return;
      if (fitMode) setFit(); else applyTransform();
    });
    ro.observe(stage);

    // ---------- Drop to open ----------
    let dropDepth = 0;
    const endDrop = () => { dropDepth = 0; droptip.hidden = true; };
    elApp.addEventListener('dragenter', (e) => { if (hasFiles(e) || hasPaths(e)) { dropDepth++; droptip.hidden = false; } });
    elApp.addEventListener('dragleave', (e) => {
      if ((hasFiles(e) || hasPaths(e)) && --dropDepth <= 0) endDrop();
    });
    elApp.addEventListener('dragover', (e) => {
      if (!hasFiles(e) && !hasPaths(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    elApp.addEventListener('drop', async (e) => {
      if (!hasFiles(e) && !hasPaths(e)) return;
      e.preventDefault();
      const internal = hasPaths(e) ? readDragPaths(e) : null;
      const external = (!internal && hasFiles(e)) ? await filesFromDrop(e) : null;
      endDrop();
      if (internal) {
        const name = internal.names.find(isImage);
        if (name) await openPath(joinPath(internal.dir, name));
        else dialogs.toast('That isn’t an image file.', { danger: true });
      } else if (external) {
        await ingest(external.files, { skippedFolders: external.skippedFolders });
      }
    });

    // ---------- Lifecycle ----------
    const unsub = vfs.on('change', (p) => { if (p === dir) queueRescan(); });
    ctx.onFocus(focusApp);
    ctx.onCleanup(() => {
      unsub();
      clearTimeout(rescanTimer);
      clearTimeout(loadTimer);
      clearTimeout(phTimer);
      if (paintRaf) cancelAnimationFrame(paintRaf);
      ro.disconnect();
      stopGrid();
      loadSeq++;
      preloadGen++;
      for (const e of cache.values()) dispose(e);
      cache.clear();
      exitFs();
    });

    updateChrome();
    if (args.path) await openPath(args.path);
    focusApp();
  }
};
