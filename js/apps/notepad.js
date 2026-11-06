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

    body.innerHTML = `
      <div style="display:flex; flex-direction:column; height:100%;">
        <div class="app-toolbar">
          <button class="toolbar-btn btn-save" disabled>
            <svg class="icon"><use href="#i-file-text"/></svg> Save
          </button>
        </div>
        <textarea class="app-textarea" style="flex:1; border:none; border-radius:0; padding:12px; resize:none; font-family:var(--font-mono); font-size:13px; line-height:1.5;" spellcheck="false" placeholder="Type here..."></textarea>
        <div class="app-statusbar">
          <div class="sb-cell grow sb-info">Ready</div>
        </div>
      </div>
    `;

    const editor = body.querySelector('textarea');
    const btnSave = body.querySelector('.btn-save');
    const elInfo = body.querySelector('.sb-info');

    const updateTitle = () => {
      const name = currentPath ? currentPath.split('/').pop() : 'Untitled';
      ctx.setTitle(`${name}${isDirty ? '*' : ''} — Notepad`);
    };

    const updateState = () => {
      isDirty = editor.value !== originalText;
      btnSave.disabled = !isDirty && currentPath;
      
      const lines = editor.value.split('\n').length;
      const chars = editor.value.length;
      elInfo.textContent = `${lines} lines, ${chars} chars`;
      
      updateTitle();
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
        // Save As
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

    editor.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isDirty || !currentPath) handleSave();
      }
    });

    btnSave.onclick = handleSave;

    // --- Init ---
    if (currentPath) {
      await loadFile(currentPath);
    } else {
      updateState();
      editor.focus();
    }

    // Handle closing with unsaved changes
    ctx.onCleanup(async () => {
      if (isDirty) {
        // Note: Standard confirm() is synchronous, but our dialogs are async.
        // In a real OS, this would block closing, but for our web implementation,
        // we'll just fire a warning dialog as it closes.
        dialogs.confirm('Unsaved Changes', 'You have unsaved changes. Close anyway?');
      }
    });
  }
};
