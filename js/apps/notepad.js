import * as vfs from '../core/vfs.js';
import * as dialogs from '../core/dialogs.js';
import { iconHTML } from '../core/icons.js';
import { baseName } from '../core/util.js';

export const notepadApp = {
  id: 'notepad',
  name: 'Notepad',
  icon: 'notepad',
  defaultSize: [640, 480],

  async launch(body, args, ctx) {
    let currentPath = args.path || null;
    let isDirty = false;
    let originalText = '';
    let wordWrap = true;
    let fontSize = 13;
    let statsRaf = 0;

    body.innerHTML = `
      <div class="np-app">
        <div class="app-toolbar">
          <button class="toolbar-btn btn-save" disabled>${iconHTML('file-text', 14)} Save</button>
          <div class="toolbar-sep"></div>
          <button class="toolbar-btn btn-wrap" aria-pressed="true" title="Toggle word wrap">${iconHTML('list', 14)} Wrap</button>
          <button class="toolbar-btn btn-zoom-out" title="Zoom out" aria-label="Zoom out">−</button>
          <button class="toolbar-btn btn-zoom-in" title="Zoom in" aria-label="Zoom in">+</button>
        </div>
        <textarea class="app-textarea np-editor" spellcheck="false" placeholder="Type here..."></textarea>
        <div class="app-statusbar">
          <div class="sb-cell grow sb-info">Ready</div>
          <div class="sb-cell sb-cursor">Ln 1, Col 1</div>
        </div>
      </div>`;

    const $ = (s) => body.querySelector(s);
    const editor = $('.np-editor');
    const btnSave = $('.btn-save');
    const btnWrap = $('.btn-wrap');
    const elInfo = $('.sb-info');
    const elCursor = $('.sb-cursor');

    const updateTitle = () =>
      ctx.setTitle(`${currentPath ? baseName(currentPath) : 'Untitled'}${isDirty ? '*' : ''} — Notepad`);

    function updateCursor() {
      const before = editor.value.slice(0, editor.selectionStart);
      const nl = before.lastIndexOf('\n');
      let line = 1;
      for (let i = before.indexOf('\n'); i !== -1; i = before.indexOf('\n', i + 1)) line++;
      elCursor.textContent = `Ln ${line}, Col ${before.length - nl}`;
    }

    // Cheap state (dirty flag, title) updates immediately; the O(n) stats are coalesced per frame.
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
          elInfo.textContent = `${lines} lines, ${v.length} chars`;
          updateCursor();
        });
      }
    }

    async function loadFile(path) {
      try {
        elInfo.textContent = 'Loading...';
        const text = await (await vfs.read(path)).text();
        currentPath = path;
        originalText = editor.value = text;
        isDirty = false;
        updateTitle();
        updateState();
        editor.focus();
      } catch (err) {
        elInfo.textContent = 'Error';
        dialogs.alert('Error', 'Could not read file: ' + err.message);
      }
    }

    /** Returns true if saved (or nothing to save). */
    async function save() {
      let path = currentPath;
      if (!path) {
        path = await dialogs.filePicker('Save As', 'save', '/home/user/Documents', 'untitled.txt');
        if (!path) return false;
      }
      try {
        btnSave.disabled = true;
        elInfo.textContent = 'Saving...';
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
          dialogs.alert('Disk Full', 'The browser storage limit has been reached. Please delete some files or click "Request More Space" in the File Manager.');
        } else {
          dialogs.alert('Error', 'Could not save file: ' + err.message);
        }
        return false;
      }
    }

    // --- Events ---
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
        // execCommand keeps the browser's undo stack intact; fall back to manual insert.
        if (!document.execCommand('insertText', false, '\t')) {
          const { selectionStart: s, selectionEnd: en, value } = editor;
          editor.value = value.slice(0, s) + '\t' + value.slice(en);
          editor.selectionStart = editor.selectionEnd = s + 1;
          updateState();
        }
      }
    });

    btnSave.onclick = save;
    btnWrap.onclick = () => {
      wordWrap = !wordWrap;
      editor.style.whiteSpace = wordWrap ? 'pre-wrap' : 'pre';
      btnWrap.setAttribute('aria-pressed', wordWrap);
    };
    const zoom = (d) => { fontSize = Math.max(10, Math.min(32, fontSize + d)); editor.style.fontSize = fontSize + 'px'; };
    $('.btn-zoom-in').onclick = () => zoom(2);
    $('.btn-zoom-out').onclick = () => zoom(-2);

    // Ask before closing with unsaved changes (the window manager awaits this).
    ctx.onBeforeClose(async () => {
      if (!isDirty) return true;
      const discard = await dialogs.confirm("Unsaved Changes", "You have unsaved changes. Discard them and close?", "Discard");
      return discard; // true → close, false → stay open
    });
    ctx.onFocus(() => editor.focus({ preventScroll: true }));
    ctx.onCleanup(() => cancelAnimationFrame(statsRaf));

    // --- Init ---
    if (currentPath) await loadFile(currentPath);
    else { updateTitle(); updateState(); editor.focus(); }
  }
};
