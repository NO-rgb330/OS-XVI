/* ============================================================
   Notepad — a two-mode text editor/viewer.

   Mode is picked once, from the file size on open:

     · edit  (< 20 MB)   — the original <textarea>. Fast, simple,
                           undo/redo, all native. Above ~5 MB a
                           "large file" hint appears in the status bar.
     · view  (< 1 GB)    — a virtualized renderer. The file is never
                           loaded as one string; a streaming line
                           index is built once (with progress), then
                           only the ~60 visible lines are decoded on
                           each scroll. Text selection is limited to
                           the viewport (standard for virtual lists).
     · refuse (≥ 1 GB)   — the browser can't hold text of that size
                           in a single DOM node; the alternative
                           would be silent failure or a crash.

   The reason for the split: no <textarea> survives 100 MB in any
   browser, and even a static <pre> of 1 GB overflows Chrome's
   rendering pipeline. The view mode is the only way to see a file
   that large in-browser without freezing.
   ============================================================ */

import * as vfs from '../core/vfs.js';
import * as dialogs from '../core/dialogs.js';
import { iconHTML } from '../core/icons.js';
import { baseName, formatBytes } from '../core/util.js';

const EDIT_MAX = 20 * 1024 * 1024;        // 20 MB — comfortable for a <textarea>
const VIEW_MAX = 1024 * 1024 * 1024;      // 1 GB  — beyond this, refuse
const LARGE_HINT = 5 * 1024 * 1024;       // 5 MB  — show "large file" hint in edit mode
const PAGE_BUFFER = 40;                   // lines above and below viewport to pre-fetch

/** Build a byte-offset index of every line start. Streams the Blob; never loads it whole. */
async function buildLineIndex(blob, onProgress, signal) {
  const index = [0];
  const reader = blob.stream().getReader();
  let bytesRead = 0;
  let lastProgressAt = 0;

  try {
    for (;;) {
      if (signal?.aborted) throw new Error('aborted');
      const { value, done } = await reader.read();
      if (done) break;

      const base = bytesRead;
      bytesRead += value.byteLength;

      // Fast scan: native Uint8Array.indexOf is much quicker than a manual loop.
      let i = 0;
      while ((i = value.indexOf(10, i)) !== -1) {
        index.push(base + i + 1);
        i++;
      }

      const now = performance.now();
      if (onProgress && now - lastProgressAt > 200) {
        lastProgressAt = now;
        onProgress(bytesRead, blob.size);
      }
    }
  } catch (err) {
    try { reader.cancel(); } catch { /* already closed */ }
    throw err;
  }

  if (bytesRead === 0) {
    index.push(0);              // empty file → 1 line
  } else if (index[index.length - 1] !== bytesRead) {
    index.push(bytesRead);      // last line has no trailing \n
  }

  return new Uint32Array(index);
}

/** Read the text of lines [start, end) from `blob` using the byte index. */
async function readLines(blob, lineOffsets, start, end) {
  if (start >= end) return '';
  const byteStart = lineOffsets[start];
  const byteEnd = lineOffsets[end] ?? blob.size;
  return blob.slice(byteStart, byteEnd).text();
}

export const notepadApp = {
  id: 'notepad',
  name: 'Notepad',
  icon: 'notepad',
  defaultSize: [700, 520],

  async launch(body, args, ctx) {
    let currentPath = args.path || null;
    let isDirty = false;
    let originalText = '';
    let wordWrap = true;
    let fontSize = 13;
    let statsRaf = 0;

    // View-mode state
    let mode = 'edit';
    let viewBlob = null;
    let lineOffsets = null;
    let lineCount = 0;
    let lineHeight = 20;
    let renderRaf = 0;
    let lastRenderedRange = [-1, -1];
    let indexAbort = null;
    let lastScrollTop = 0;

    body.innerHTML = `
      <div class="np-app">
        <div class="app-toolbar">
          <button class="toolbar-btn btn-save" disabled>${iconHTML('file-text', 14)} Save</button>
          <div class="toolbar-sep"></div>
          <button class="toolbar-btn btn-wrap" aria-pressed="true" title="Toggle word wrap">${iconHTML('list', 14)} Wrap</button>
          <button class="toolbar-btn btn-zoom-out" title="Zoom out" aria-label="Zoom out">−</button>
          <button class="toolbar-btn btn-zoom-in" title="Zoom in" aria-label="Zoom in">+</button>
        </div>

        <div class="np-main">
          <textarea class="app-textarea np-editor" spellcheck="false" placeholder="Type here..."></textarea>

          <div class="np-viewer" hidden>
            <div class="np-viewer-scroll">
              <pre class="np-visible" spellcheck="false" aria-readonly="true"></pre>
              <div class="np-spacer"></div>
            </div>
            <div class="np-indexing">
              <div class="np-indexing-title">Indexing large file…</div>
              <div class="np-indexing-text">Preparing…</div>
              <div class="np-indexing-bar"><div class="np-indexing-fill"></div></div>
            </div>
          </div>
        </div>

        <div class="app-statusbar">
          <div class="sb-cell grow sb-info">Ready</div>
          <div class="sb-cell sb-mode" hidden></div>
          <div class="sb-cell sb-cursor">Ln 1, Col 1</div>
          <div class="sb-cell sb-lines"></div>
        </div>
      </div>`;

    const $ = (s) => body.querySelector(s);
    const editor = $('.np-editor');
    const btnSave = $('.btn-save');
    const btnWrap = $('.btn-wrap');
    const btnZoomIn = $('.btn-zoom-in');
    const btnZoomOut = $('.btn-zoom-out');
    const elInfo = $('.sb-info');
    const elCursor = $('.sb-cursor');
    const elLines = $('.sb-lines');
    const elMode = $('.sb-mode');
    const viewer = $('.np-viewer');
    const viewerScroll = $('.np-viewer-scroll');
    const pre = $('.np-visible');
    const spacer = $('.np-spacer');
    const indexing = $('.np-indexing');

    const updateTitle = () =>
      ctx.setTitle(`${currentPath ? baseName(currentPath) : 'Untitled'}${isDirty ? '*' : ''} — Notepad`);

    // ---------- Edit-mode helpers ----------
    function updateCursor() {
      const before = editor.value.slice(0, editor.selectionStart);
      const nl = before.lastIndexOf('\n');
      let line = 1;
      for (let i = before.indexOf('\n'); i !== -1; i = before.indexOf('\n', i + 1)) line++;
      elCursor.textContent = `Ln ${line}, Col ${before.length - nl}`;
    }

    function updateState() {
      const dirty = editor.value !== originalText;
      if (dirty !== isDirty) { isDirty = dirty; updateTitle(); }
      btnSave.disabled = !isDirty && !!currentPath;
      if (!statsRaf) {
        statsRaf = requestAnimationFrame(() => {
          statsRaf = 0;
          const v = editor.value;
          let lines = 1;
          for (let i = v.indexOf('\n'); i !== -1; i = v.indexOf('\n', i + 1)) lines++;
          elLines.textContent = `${lines} lines · ${v.length} chars`;
          updateCursor();
          elInfo.textContent = isDirty ? 'Modified' : 'Ready';
        });
      }
    }

    // ---------- View-mode rendering ----------
    function visibleRange() {
      const scrollTop = viewerScroll.scrollTop;
      const viewport = viewerScroll.clientHeight;
      const first = Math.max(0, Math.floor(scrollTop / lineHeight) - PAGE_BUFFER);
      const last = Math.min(lineCount, Math.ceil((scrollTop + viewport) / lineHeight) + PAGE_BUFFER);
      return [first, last];
    }

    async function renderViewport() {
      if (!viewBlob || !lineOffsets || mode !== 'view') return;
      const [start, end] = visibleRange();
      if (start === lastRenderedRange[0] && end === lastRenderedRange[1]) return;
      lastRenderedRange = [start, end];
      const seq = ++renderSeq;
      try {
        const text = await readLines(viewBlob, lineOffsets, start, end);
        if (seq !== renderSeq) return; // superseded by a newer render
        pre.textContent = text;
        // Anchor the first rendered line at the exact scroll offset.
        const offset = start * lineHeight - viewerScroll.scrollTop;
        pre.style.transform = `translateY(${offset}px)`;
      } catch (err) {
        console.error('Render error', err);
      }
    }

    let renderSeq = 0;

    function onViewScroll() {
      if (renderRaf) return;
      renderRaf = requestAnimationFrame(() => {
        renderRaf = 0;
        const scrollTop = viewerScroll.scrollTop;
        if (Math.abs(scrollTop - lastScrollTop) < 1) return; // no actual movement
        lastScrollTop = scrollTop;
        renderViewport();
        const topLine = Math.min(lineCount, Math.floor(scrollTop / lineHeight) + 1);
        elCursor.textContent = `Ln ${topLine}`;
      });
    }

    function applyFontSize() {
      editor.style.fontSize = fontSize + 'px';
      lineHeight = Math.round(fontSize * 1.5);
      pre.style.fontSize = fontSize + 'px';
      pre.style.lineHeight = lineHeight + 'px';
      if (mode === 'view' && lineOffsets) {
        spacer.style.height = (lineCount * lineHeight) + 'px';
        lastRenderedRange = [-1, -1];
        renderViewport();
      }
    }

    function toggleWrap() {
      wordWrap = !wordWrap;
      btnWrap.setAttribute('aria-pressed', String(wordWrap));
      editor.style.whiteSpace = wordWrap ? 'pre-wrap' : 'pre';
      // View mode uses `white-space: pre` + fixed line-height for virtualization;
      // wrapping would break the byte-to-line mapping, so it's edit-only.
    }

    // ---------- Load ----------
    async function openInView(blob, totalSize) {
      mode = 'view';
      viewBlob = blob;
      editor.hidden = true;
      viewer.hidden = false;
      btnSave.disabled = true;
      btnWrap.disabled = true;
      elMode.hidden = false;
      elMode.textContent = 'Read-only';

      indexing.hidden = false;
      const textEl = indexing.querySelector('.np-indexing-text');
      const fillEl = indexing.querySelector('.np-indexing-fill');

      indexAbort = new AbortController();
      try {
        lineOffsets = await buildLineIndex(blob, (done, total) => {
          const pct = total ? done / total : 0;
          textEl.textContent = `${formatBytes(done)} of ${formatBytes(total)} — ${Math.round(pct * 100)}%`;
          fillEl.style.width = (pct * 100) + '%';
        }, indexAbort.signal);
      } catch (err) {
        indexAbort = null;
        if (err.message === 'aborted') return;
        indexing.hidden = true;
        await dialogs.alert('Notepad', 'Could not index the file: ' + err.message);
        return;
      }
      indexAbort = null;

      if (lineOffsets.length < 2) {
        indexing.hidden = true;
        return;
      }

      lineCount = lineOffsets.length - 1;
      spacer.style.height = (lineCount * lineHeight) + 'px';
      indexing.hidden = true;
      elLines.textContent = `${lineCount.toLocaleString()} lines · ${formatBytes(totalSize)}`;
      elInfo.textContent = 'Read-only (large file)';
      viewerScroll.addEventListener('scroll', onViewScroll, { passive: true });
      viewerScroll.scrollTop = 0;
      lastScrollTop = 0;
      lastRenderedRange = [-1, -1];
      renderViewport();
      // Focus so keyboard scroll (arrow keys / PgUp / PgDn) works.
      viewerScroll.focus?.();
    }

    function openInEdit(text) {
      mode = 'edit';
      editor.hidden = false;
      viewer.hidden = true;
      btnWrap.disabled = false;
      elMode.hidden = true;
      editor.value = text;
      originalText = text;
      isDirty = false;
      updateState();
      updateTitle();
      editor.focus();
      if (text.length > LARGE_HINT) {
        elInfo.textContent = `Large file (${formatBytes(text.length)}) — editing may be slow`;
      }
    }

    async function loadFile(path) {
      try {
        elInfo.textContent = 'Loading…';
        const stat = await vfs.stat(path);
        const size = stat.size || 0;

        if (size > VIEW_MAX) {
          elInfo.textContent = 'Too large to open';
          await dialogs.alert('Notepad',
            `"${baseName(path)}" is ${formatBytes(size)}. Notepad can open text files up to ${formatBytes(VIEW_MAX)} — ` +
            `larger files can’t be represented in a browser window without freezing.`);
          return;
        }

        if (size > EDIT_MAX) {
          // View mode
          const blob = await vfs.read(path);
          currentPath = path;
          updateTitle();
          await openInView(blob, size);
          return;
        }

        // Edit mode
        const text = await (await vfs.read(path)).text();
        currentPath = path;
        openInEdit(text);
      } catch (err) {
        elInfo.textContent = 'Error';
        await dialogs.alert('Notepad', 'Could not read file: ' + err.message);
      }
    }

    // ---------- Save ----------
    async function save() {
      if (mode !== 'edit') return false;
      let path = currentPath;
      if (!path) {
        path = await dialogs.filePicker('Save As', 'save', '/home/user/Documents', 'untitled.txt');
        if (!path) return false;
      }
      try {
        btnSave.disabled = true;
        elInfo.textContent = 'Saving…';
        const text = editor.value;
        await vfs.write(path, text);
        currentPath = path;
        originalText = text;
        isDirty = editor.value !== text;
        updateTitle();
        updateState();
        elInfo.textContent = 'Saved.';
        return true;
      } catch (err) {
        updateState();
        if (err.message.includes('ENOSPC')) {
          dialogs.alert('Disk Full',
            'The browser storage limit has been reached. Delete some files or click "Request More Space" in the File Manager.');
        } else {
          dialogs.alert('Error', 'Could not save file: ' + err.message);
        }
        return false;
      }
    }

    // ---------- Events ----------
    editor.addEventListener('input', updateState);
    editor.addEventListener('click', updateState);
    editor.addEventListener('keyup', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) updateState();
    });
    editor.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (isDirty || !currentPath) save();
      } else if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        if (!document.execCommand('insertText', false, '\t')) {
          const { selectionStart: s, selectionEnd: en, value } = editor;
          editor.value = value.slice(0, s) + '\t' + value.slice(en);
          editor.selectionStart = editor.selectionEnd = s + 1;
          updateState();
        }
      }
    });

    btnSave.onclick = save;
    btnWrap.onclick = toggleWrap;
    btnZoomIn.onclick = () => {
      fontSize = Math.max(10, Math.min(32, fontSize + 2));
      applyFontSize();
    };
    btnZoomOut.onclick = () => {
      fontSize = Math.max(10, Math.min(32, fontSize - 2));
      applyFontSize();
    };

    // Resize observer re-renders the viewport when the window changes size.
    const ro = new ResizeObserver(() => {
      if (mode === 'view') { lastRenderedRange = [-1, -1]; renderViewport(); }
    });
    ro.observe(viewer);

    ctx.onBeforeClose(async () => {
      if (mode === 'view') return true;
      if (!isDirty) return true;
      const discard = await dialogs.confirm(
        'Unsaved Changes',
        'You have unsaved changes. Discard them and close?',
        'Discard');
      return discard;
    });
    ctx.onFocus(() => {
      if (mode === 'view') viewerScroll.focus?.();
      else editor.focus({ preventScroll: true });
    });
    ctx.onCleanup(() => {
      cancelAnimationFrame(statsRaf);
      cancelAnimationFrame(renderRaf);
      if (indexAbort) { try { indexAbort.abort(); } catch { /* ignore */ } }
      ro.disconnect();
    });

    // ---------- Init ----------
    if (currentPath) await loadFile(currentPath);
    else { updateTitle(); updateState(); editor.focus(); }
  }
};
