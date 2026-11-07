/* ============================================================
   Image Viewer — a standalone app.
   It can open images by itself (virtual-disk picker, upload from the
   computer, or drag & drop), browses the other images in the same
   folder, and stays in sync when that folder changes.

   View model: the <img> is laid out at its natural size and positioned
   purely by a transform:  translate(centre) · rotate · scale.
   State is { scale, cx, cy, rot } where (cx, cy) is the image centre
   in stage pixels, so zooming around a point is simple algebra.
   ============================================================ */

import * as vfs from '../core/vfs.js';
import * as dialogs from '../core/dialogs.js';
import { iconHTML } from '../core/icons.js';
import { esc, joinPath, parentPath, baseName, formatBytes, mimeOf } from '../core/util.js';
import { IMAGE, isImage } from '../core/files.js';
import { hasPaths, hasFiles, readDragPaths, filesFromDrop } from '../core/dnd.js';
import { pickFiles, uploadFiles } from '../core/upload.js';

const MIN_SCALE = 0.02;
const MAX_SCALE = 40;
const ZOOM_STEP = 1.25;
const PICTURES = '/home/user/Pictures';

const btn = (cmd, title, icon, label = '') =>
  `<button type="button" class="toolbar-btn" data-cmd="${cmd}" title="${esc(title)}" aria-label="${esc(title)}">${iconHTML(icon, 14)}${label ? `<span>${label}</span>` : ''}</button>`;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export const imageViewerApp = {
  id: 'imageviewer',
  name: 'Image Viewer',
  icon: 'gallery',
  defaultSize: [820, 580],

  async launch(body, args, ctx) {
    // ---------- State ----------
    let dir = null;                 // folder being browsed
    let files = [];                 // images in `dir`: { name, path, size, mtime }
    let index = -1;                 // current image in `files`
    let url = null;                 // object URL of the displayed image
    let nat = { w: 0, h: 0 };       // natural size
    let scale = 1, cx = 0, cy = 0, rot = 0;
    let fitMode = true;             // true while the image is auto-fitted to the stage
    let hasImage = false;           // an image is currently displayed
    let mode = 'single';            // 'single' | 'grid'
    let loadSeq = 0;                // discards results of superseded loads
    let rescanTimer = 0;

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
    const img = $('.iv-img');
    const msg = $('.iv-msg');
    const grid = $('.iv-grid');
    const empty = $('.iv-empty');
    const droptip = $('.iv-droptip');
    const cmdBtn = (c) => body.querySelector(`.iv-toolbar [data-cmd="${c}"]`);
    const focusApp = () => elApp.focus({ preventScroll: true });

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

    function applyTransform() {
      if (!hasImage) return;
      const s = stageSize(), b = shownSize();
      // Centre when smaller than the stage; otherwise stop at the edges.
      cx = b.w <= s.w ? s.w / 2 : Math.min(b.w / 2, Math.max(s.w - b.w / 2, cx));
      cy = b.h <= s.h ? s.h / 2 : Math.min(b.h / 2, Math.max(s.h - b.h / 2, cy));
      img.style.transform = `translate(${cx - nat.w / 2}px, ${cy - nat.h / 2}px) rotate(${rot}deg) scale(${scale})`;
      $('.iv-s-zoom').textContent = Math.round(scale * 100) + '%';
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
    function zoomTo(next, px, py) {
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
      applyTransform();
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
      for (const c of ['prev', 'next']) cmdBtn(c).disabled = !multi;
      body.querySelectorAll('.iv-nav').forEach((b) => { b.hidden = !multi; });
      const canView = hasImage && mode === 'single';
      for (const c of ['zoomin', 'zoomout', 'fit', 'actual', 'rotl', 'rotr']) cmdBtn(c).disabled = !canView;
      cmdBtn('grid').disabled = !any;
      cmdBtn('grid').setAttribute('aria-pressed', String(mode === 'grid'));
      updateStatus();
    }

    function updateStatus() {
      const f = files[index];
      $('.iv-s-name').textContent = f ? f.name : 'No image open';
      $('.iv-s-dim').textContent = f && hasImage ? `${nat.w} × ${nat.h}` : '';
      $('.iv-s-size').textContent = f ? formatBytes(f.size) : '';
      $('.iv-s-pos').textContent = f && files.length ? `${index + 1} / ${files.length}` : '';
      if (!hasImage) $('.iv-s-zoom').textContent = '';
      ctx.setTitle(f ? `${f.name} — Image Viewer` : 'Image Viewer');
    }

    function showMessage(text) {
      msg.textContent = text || '';
      msg.hidden = !text;
    }

    // ---------- Loading ----------
    async function scanDir(d) {
      return (await vfs.list(d))
        .filter((it) => it.kind === 'file' && isImage(it.name))
        .map((it) => ({ name: it.name, path: joinPath(d, it.name), size: it.size || 0, mtime: it.mtime || 0 }));
    }

    function clearImage() {
      loadSeq++;
      hasImage = false;
      img.hidden = true;
      img.removeAttribute('src');
      if (url) { URL.revokeObjectURL(url); url = null; }
      showMessage('');
    }

    async function showIndex(i) {
      if (i < 0 || i >= files.length) return;
      const seq = ++loadSeq;
      index = i;
      const f = files[i];
      updateChrome();
      let blobUrl = null;
      try {
        const file = await vfs.read(f.path);
        if (seq !== loadSeq) return;
        // Blobs from OPFS have no MIME type; without one SVGs (and some others) won't render.
        blobUrl = URL.createObjectURL(new Blob([file], { type: mimeOf(f.name) }));
        const probe = new Image();
        await new Promise((resolve, reject) => {
          probe.onload = resolve;
          probe.onerror = () => reject(new Error('This file isn’t a valid image, or its format isn’t supported by your browser.'));
          probe.src = blobUrl;
        });
        if (seq !== loadSeq) { URL.revokeObjectURL(blobUrl); return; }

        const previous = url;
        url = blobUrl;
        nat = { w: probe.naturalWidth || 512, h: probe.naturalHeight || 512 };
        img.style.width = nat.w + 'px';
        img.style.height = nat.h + 'px';
        img.src = url;
        if (previous) URL.revokeObjectURL(previous);
        rot = 0;
        hasImage = true;
        img.hidden = false;
        showMessage('');
        updateChrome();
        setFit();
      } catch (err) {
        if (blobUrl && blobUrl !== url) URL.revokeObjectURL(blobUrl);
        if (seq !== loadSeq) return;
        hasImage = false;
        img.hidden = true;
        showMessage(`Can’t open “${f.name}”.\n${err.message.replace(/^E[A-Z]+: /, '')}`);
        updateChrome();
      }
    }

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
        updateChrome();
        await showIndex(i);
        focusApp();
      } catch (err) {
        dialogs.alert('Image Viewer', `Could not open “${name}”: ${err.message.replace(/^E[A-Z]+: /, '')}`);
      }
    }

    /** Folder changed on disk: refresh the list, follow the current image, drop to a neighbour if it was deleted. */
    async function rescan() {
      if (!dir) return;
      const prev = files[index];
      let next;
      try { next = await scanDir(dir); } catch { return; }
      files = next;
      const i = prev ? files.findIndex((f) => f.name === prev.name) : -1;
      if (i >= 0) {
        index = i;
        const changed = files[i].mtime !== prev.mtime || files[i].size !== prev.size;
        updateChrome();
        if (changed) await showIndex(i);
      } else if (files.length) {
        await showIndex(Math.min(Math.max(index, 0), files.length - 1));
      } else {
        index = -1;
        clearImage();
        updateChrome();
      }
      if (mode === 'grid') buildGrid();
    }

    const step = (d) => { if (files.length > 1) showIndex((index + d + files.length) % files.length); };
    const go = (i) => { if (files.length) showIndex(Math.max(0, Math.min(files.length - 1, i))); };

    // ---------- Thumbnail grid ----------
    let gridGen = 0;
    let thumbObserver = null;
    const thumbUrls = new Set();

    function stopGrid() {
      gridGen++;
      thumbObserver?.disconnect();
      thumbObserver = null;
      for (const u of thumbUrls) URL.revokeObjectURL(u);
      thumbUrls.clear();
      grid.replaceChildren();
    }

    async function loadThumb(el, gen) {
      const f = files[Number(el.dataset.i)];
      const holder = el.firstElementChild;
      if (!f) return;
      try {
        const file = await vfs.read(f.path);
        if (gen !== gridGen) return;
        const u = URL.createObjectURL(new Blob([file], { type: mimeOf(f.name) }));
        thumbUrls.add(u);
        const im = new Image();
        im.alt = '';
        im.decoding = 'async';
        im.draggable = false;
        im.onerror = () => { holder.textContent = '?'; };
        im.src = u;
        holder.replaceChildren(im);
      } catch {
        if (gen === gridGen) holder.textContent = '?';
      }
    }

    function buildGrid() {
      stopGrid();
      const gen = gridGen;
      grid.innerHTML = files.map((f, i) => `
        <button type="button" class="iv-thumb${i === index ? ' current' : ''}" data-i="${i}" title="${esc(f.name)}">
          <div class="iv-thumb-img"></div><span>${esc(f.name)}</span>
        </button>`).join('');
      // Only decode thumbnails that are (nearly) on screen.
      thumbObserver = new IntersectionObserver((entries) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue;
          thumbObserver.unobserve(en.target);
          loadThumb(en.target, gen);
        }
      }, { root: grid, rootMargin: '240px' });
      grid.querySelectorAll('.iv-thumb').forEach((el) => thumbObserver.observe(el));
      grid.querySelector('.current')?.scrollIntoView({ block: 'nearest' });
    }

    function setMode(next) {
      if (next === 'grid' && !files.length) return;
      mode = next;
      if (mode === 'grid') { updateChrome(); buildGrid(); grid.querySelector('.current')?.focus({ preventScroll: true }); }
      else { stopGrid(); updateChrome(); if (hasImage) (fitMode ? setFit : applyTransform)(); focusApp(); }
    }

    grid.addEventListener('click', async (e) => {
      const t = e.target.closest('.iv-thumb');
      if (!t) return;
      setMode('single');
      await showIndex(Number(t.dataset.i));
    });

    // ---------- Open / upload ----------
    const exitFs = () => { if (document.fullscreenElement === elApp) Promise.resolve(document.exitFullscreen?.()).catch(() => {}); };

    async function openDialog() {
      exitFs();
      const path = await dialogs.filePicker('Open Image', 'open', dir || PICTURES, '', IMAGE);
      if (path) await openPath(path);
    }

    async function openFirstImage(saved) {
      const first = saved.find((f) => isImage(f.name));
      if (first) await openPath(first.path);
      else if (saved.length) dialogs.toast('None of those files are images.', { danger: true });
    }

    async function uploadAndOpen() {
      exitFs();
      const picked = await pickFiles({ accept: 'image/*' });
      if (picked.length) await openFirstImage((await uploadFiles(picked)).saved);
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

    const thumbEls = () => [...grid.querySelectorAll('.iv-thumb')];
    const gridColumns = () => {
      const t = thumbEls();
      let n = 1;
      while (t.length && n < t.length && t[n].offsetTop === t[0].offsetTop) n++;
      return n;
    };
    function focusThumb(delta, absolute = false) {
      const t = thumbEls();
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
        zoomTo(pinch.scale * (dist(a, b) / pinch.d), m.x, m.y);
      } else if (pan) {
        cx = pan.cx + (e.clientX - pan.x);
        cy = pan.cy + (e.clientY - pan.y);
        applyTransform();
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
      zoomTo(scale * Math.exp(-d * (e.ctrlKey ? 0.01 : 0.0015)), p.x, p.y);
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
      const external = !internal && hasFiles(e) ? filesFromDrop(e) : null;
      endDrop();
      if (internal) {
        const name = internal.names.find(isImage);
        if (name) await openPath(joinPath(internal.dir, name));
        else dialogs.toast('That isn’t an image file.', { danger: true });
      } else if (external) {
        await openFirstImage((await uploadFiles(external.files, { skippedFolders: external.skippedFolders })).saved);
      }
    });

    // ---------- Lifecycle ----------
    const unsub = vfs.on('change', (p) => {
      if (p !== dir) return;
      clearTimeout(rescanTimer);
      rescanTimer = setTimeout(rescan, 80);
    });
    ctx.onFocus(focusApp);
    ctx.onCleanup(() => {
      unsub();
      clearTimeout(rescanTimer);
      ro.disconnect();
      stopGrid();
      loadSeq++;
      if (url) URL.revokeObjectURL(url);
      exitFs();
    });

    updateChrome();
    if (args.path) await openPath(args.path);
    focusApp();
  }
};
