import * as vfs from '../core/vfs.js';
import * as dialogs from '../core/dialogs.js';

export const notepadApp = {
  id: 'notepad',
  name: 'Notepad',
  icon: 'notepad',
  defaultSize: [640, 480],

  launch: async function(body, args, ctx) {
    let currentPath = args.path || null;
    let isDirty = false;
    let originalText = '';
    let wordWrap = true;
    let fontSize = 13;

    body.innerHTML = `
      <div style="display:flex; flex-direction:column; height:100%;">
        <div class="app-toolbar">
          <button class="toolbar-btn btn-save" disabled>
            <svg class="icon"><use href="#i-file-text"/></svg> Save
          </button>
          <div class="toolbar-sep"></div>
          <button class="toolbar-btn btn-wrap active" title="Toggle Word Wrap" style="background:var(--surface-2)">
            <svg class="icon"><use href="#i-list"/></svg> Wrap
          </button>
          <button class="toolbar-btn btn-zoom-out" title="Zoom Out">
            <span style="font-size:14px; font-weight:bold; line-height:1;">−</span>
          </button>
          <button class="toolbar-btn btn-zoom-in" title="Zoom In">
            <span style="font-size:14px; font-weight:bold; line-height:1;">+</span>
          </button>
        </div>
        <textarea class="app-textarea" style="flex:1; border:none; border-radius:0; padding:12px; resize:none; font-family:var(--font-mono); font-size:13px; line-height:1.5; white-space:pre-wrap;" spellcheck="false" placeholder="Type here..."></textarea>
        <div class="app-statusbar">
          <div class="sb-cell grow sb-info">Ready</div>
          <div class="sb-cell sb-cursor">Ln 1, Col 1</div>
        </div>
      </div>
    `;

    const editor = body.querySelector('textarea');
    const btnSave = body.querySelector('.btn-save');
    const btnWrap = body.querySelector('.btn-wrap');
    const btnZoomIn = body.querySelector('.btn-zoom-in');
    const btnZoomOut = body.querySelector('.btn-zoom-out');
    const elInfo = body.querySelector('.sb-info');
    const elCursor = body.querySelector('.sb-cursor');

    const updateTitle = () => {
      const name = currentPath ? currentPath.split('/').pop() : 'Untitled';
      ctx.setTitle(`${name}${isDirty ? '*' : ''} — Notepad`);
    };

    const updateCursor = () => {
      const text = editor.value.substring(0, editor.selectionStart);
      const lines = text.split('\n');
      const line = lines.length;
      const col = lines[lines.length - 1].length + 1;
      elCursor.textContent = `Ln ${line}, Col ${col}`;
    };

    const updateState = () => {
      isDirty = editor.value !== originalText;
      btnSave.disabled = !isDirty && currentPath;
      
      const lines = editor.value.split('\n').length;
      const chars = editor.value.length;
      elInfo.textContent = `${lines} lines, ${chars} chars`;
      
      updateTitle();
      updateCursor();
    };

    const loadFile = async (path) => {
      try {
        elInfo.textContent = 'Loading...';
        const blob = await vfs.read(path);
        const text = await blob.text();
        
        currentPath = path;
        originalText = text;
        editor.value = text;
        isDirty = false;
        
        updateState();
        editor.focus();
      } catch (err) {
        dialogs.alert('Error', 'Could not read file: ' + err.message);
        elInfo.textContent = 'Error';
      }
    };

    const handleSave = async () => {
      let savePath = currentPath;
      if (!savePath) {
        savePath = await dialogs.filePicker('Save As', 'save', '/home/user/Documents', 'untitled.txt');
        if (!savePath) return;
      }
      try {
        btnSave.disabled = true;
        elInfo.textContent = 'Saving...';
        await vfs.write(savePath, editor.value);
        currentPath = savePath;
        originalText = editor.value;
        isDirty = false;
        updateState();
        elInfo.textContent = 'Saved.';
      } catch (err) {
        dialogs.alert('Error', 'Could not save file: ' + err.message);
        updateState();
      }
    };

    // --- Events ---
    editor.addEventListener('input', updateState);
    editor.addEventListener('click', updateCursor);
    editor.addEventListener('keyup', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) updateCursor();
    });

    editor.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isDirty || !currentPath) handleSave();
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        editor.value = editor.value.substring(0, start) + '\t' + editor.value.substring(end);
        editor.selectionStart = editor.selectionEnd = start + 1;
        updateState();
      }
    });

    btnSave.onclick = handleSave;

    btnWrap.onclick = () => {
      wordWrap = !wordWrap;
      editor.style.whiteSpace = wordWrap ? 'pre-wrap' : 'pre';
      btnWrap.style.background = wordWrap ? 'var(--surface-2)' : 'transparent';
    };

    btnZoomIn.onclick = () => {
      fontSize = Math.min(32, fontSize + 2);
      editor.style.fontSize = fontSize + 'px';
    };

    btnZoomOut.onclick = () => {
      fontSize = Math.max(10, fontSize - 2);
      editor.style.fontSize = fontSize + 'px';
    };

    // --- Init ---
    if (currentPath) {
      await loadFile(currentPath);
    } else {
      updateState();
      editor.focus();
    }

    ctx.onCleanup(async () => {
      if (isDirty) {
        dialogs.confirm('Unsaved Changes', 'You have unsaved changes. Close anyway?');
      }
    });
  }
};
