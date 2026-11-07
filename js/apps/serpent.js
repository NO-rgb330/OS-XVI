import * as vfs from '../core/vfs.js';
import * as dialogs from '../core/dialogs.js';
import { iconHTML } from '../core/icons.js';
import { CodeEditor } from '../core/code-editor.js';
import { openWindow } from '../core/wm.js';

const PROJECT_DIR = '/home/user/Projects';

export const serpentApp = {
  id: 'serpent',
  name: 'Serpent',
  icon: 'python',
  defaultSize: [900, 600],

  async launch(body, args, ctx) {
    let pyodide = null;
    let pyLoading = false;
    let openFiles = new Map(); // path -> { editor, tabEl, dirty }
    let activeFile = null;
    let projectTreeEl = null;
    let tabsEl = null;
    let editorContainer = null;
    let consoleEl = null;

    // Ensure project dir exists
    if (!(await vfs.exists(PROJECT_DIR))) {
      await vfs.mkdir(PROJECT_DIR);
      await vfs.write(`${PROJECT_DIR}/main.py`, 'def greet(name):\n    return f"Hello, {name}!"\n\nprint(greet("Developer"))\n');
    }

    body.innerHTML = `
      <div class="ide-app">
        <div class="ide-toolbar">
          <button class="toolbar-btn btn-run primary">${iconHTML('play', 14)} Run</button>
          <button class="toolbar-btn btn-save" disabled>${iconHTML('file-text', 14)} Save</button>
          <div class="toolbar-sep"></div>
          <button class="toolbar-btn btn-new">${iconHTML('file-plus', 14)} New File</button>
          <button class="toolbar-btn btn-clear">${iconHTML('trash', 14)} Clear Console</button>
          <div style="flex:1"></div>
          <span class="muted" style="font-size:11px" id="serpent-status">Ready</span>
        </div>
        
        <div class="ide-split">
          <div class="ide-sidebar">
            <div class="ide-sidebar-header">Project: Projects</div>
            <div id="serpent-tree"></div>
          </div>
          
          <div class="ide-main">
            <div class="ide-tabs" id="serpent-tabs"></div>
            <div class="code-editor-container" id="serpent-editor" style="flex:1; display:flex; flex-direction:column;"></div>
            
            <div class="ide-bottom-panel">
              <div class="ide-bottom-header">
                <span>Console</span>
                <span class="muted" id="serpent-console-status">Not running</span>
              </div>
              <div class="ide-console" id="serpent-console"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    projectTreeEl = body.querySelector('#serpent-tree');
    tabsEl = body.querySelector('#serpent-tabs');
    editorContainer = body.querySelector('#serpent-editor');
    consoleEl = body.querySelector('#serpent-console');
    const btnRun = body.querySelector('.btn-run');
    const btnSave = body.querySelector('.btn-save');
    const btnNew = body.querySelector('.btn-new');
    const btnClear = body.querySelector('.btn-clear');
    const statusEl = body.querySelector('#serpent-status');
    const consoleStatus = body.querySelector('#serpent-console-status');

    // --- Console Output ---
    function log(text, isError = false) {
      const div = document.createElement('div');
      if (isError) div.className = 'ide-console-error';
      div.textContent = text;
      consoleEl.appendChild(div);
      consoleEl.scrollTop = consoleEl.scrollHeight;
    }

    // --- Pyodide Loader ---
    async function initPyodide() {
      if (pyodide) return pyodide;
      if (pyLoading) return;
      pyLoading = true;
      statusEl.textContent = 'Loading Python (WASM)...';
      log('Downloading Python runtime (this may take a moment)...');

      try {
        // Load Pyodide script
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
          script.onload = resolve;
          script.onerror = () => reject(new Error('Failed to load Pyodide from CDN'));
          document.head.appendChild(script);
        });

        pyodide = await window.loadPyodide({
          stdout: (text) => log(text),
          stderr: (text) => log(text, true),
          stdin: () => prompt('Python input:') || ''
        });
        
        log('Python runtime ready.');
        statusEl.textContent = 'Ready';
        return pyodide;
      } catch (err) {
        log('Error loading Python: ' + err.message, true);
        statusEl.textContent = 'Python failed to load';
        throw err;
      } finally {
        pyLoading = false;
      }
    }

    // --- File System ---
    async function loadTree() {
      projectTreeEl.innerHTML = '';
      try {
        const items = await vfs.list(PROJECT_DIR);
        for (const item of items) {
          if (item.kind === 'dir') continue; // Simplified flat view for now
          const el = document.createElement('div');
          el.className = 'ide-tree-item';
          el.innerHTML = `${iconHTML('file-text', 14)} ${item.name}`;
          el.onclick = () => openFile(item.name);
          if (activeFile === item.name) el.classList.add('active');
          projectTreeEl.appendChild(el);
        }
      } catch (e) {
        log('Error reading project: ' + e.message, true);
      }
    }

    async function openFile(filename) {
      const path = `${PROJECT_DIR}/${filename}`;
      if (openFiles.has(filename)) {
        switchTab(filename);
        return;
      }

      try {
        const blob = await vfs.read(path);
        const text = await blob.text();

        // Create Tab
        const tab = document.createElement('div');
        tab.className = 'ide-tab';
        tab.innerHTML = `${iconHTML('file-text', 12)} ${filename}`;
        tab.onclick = () => switchTab(filename);
        tabsEl.appendChild(tab);

        // Create Editor
        const edWrap = document.createElement('div');
        edWrap.style.display = 'none';
        edWrap.style.flex = '1';
        edWrap.style.flexDirection = 'column';
        editorContainer.appendChild(edWrap);

        const editor = new CodeEditor(edWrap, {
          language: 'python',
          value: text,
          onChange: () => {
            if (!openFiles.has(filename)) return;
            openFiles.get(filename).dirty = true;
            tab.innerHTML = `${iconHTML('file-text', 12)} ${filename} *`;
            btnSave.disabled = false;
          }
        });

        openFiles.set(filename, { editor, tabEl: tab, wrapEl: edWrap, dirty: false });
        switchTab(filename);
        loadTree();
      } catch (e) {
        dialogs.alert('Error', 'Could not open file: ' + e.message);
      }
    }

    function switchTab(filename) {
      if (activeFile && openFiles.has(activeFile)) {
        openFiles.get(activeFile).wrapEl.style.display = 'none';
        openFiles.get(activeFile).tabEl.classList.remove('active');
      }
      activeFile = filename;
      if (openFiles.has(filename)) {
        const f = openFiles.get(filename);
        f.wrapEl.style.display = 'flex';
        f.tabEl.classList.add('active');
        f.editor.focus();
        btnSave.disabled = !f.dirty;
      }
    }

    // --- Actions ---
    async function saveFile() {
      if (!activeFile || !openFiles.has(activeFile)) return;
      const f = openFiles.get(activeFile);
      try {
        await vfs.write(`${PROJECT_DIR}/${activeFile}`, f.editor.getValue());
        f.dirty = false;
        f.tabEl.innerHTML = `${iconHTML('file-text', 12)} ${activeFile}`;
        btnSave.disabled = true;
        log(`Saved ${activeFile}`);
      } catch (e) {
        if (e.message.includes('ENOSPC')) {
          dialogs.alert('Disk Full', 'The browser storage limit has been reached. Please delete some files or click "Request More Space" in the File Manager.');
        } else {
          dialogs.alert('Error', 'Could not save: ' + e.message);
        }
      }
    }

    async function newFile() {
      const name = await dialogs.prompt('New File', 'Filename (e.g., script.py):', 'script.py');
      if (!name) return;
      if (!name.endsWith('.py')) name += '.py';
      
      const path = `${PROJECT_DIR}/${name}`;
      if (await vfs.exists(path)) {
        dialogs.alert('Error', 'File already exists.');
        return;
      }
      
      await vfs.write(path, '# New Python File\n\n');
      await loadTree();
      openFile(name);
    }

    async function runCode() {
      if (!activeFile || !openFiles.has(activeFile)) {
        log('No file open to run.', true);
        return;
      }
      
      consoleEl.innerHTML = '';
      consoleStatus.textContent = 'Running...';
      btnRun.disabled = true;
      
      try {
        const py = await initPyodide();
        const code = openFiles.get(activeFile).editor.getValue();
        
        // Reset globals but keep imports (basic approach)
        await py.runPythonAsync(code);
        consoleStatus.textContent = 'Finished';
      } catch (err) {
        log(err.message, true);
        consoleStatus.textContent = 'Error';
      } finally {
        btnRun.disabled = false;
      }
    }

    // --- Events ---
    btnSave.onclick = saveFile;
    btnNew.onclick = newFile;
    btnRun.onclick = runCode;
    btnClear.onclick = () => { consoleEl.innerHTML = ''; };

    ctx.onCleanup(() => {
      // Cleanup any global Pyodide state if needed
    });

    // Init
    await loadTree();
    if (projectTreeEl.firstElementChild) {
      projectTreeEl.firstElementChild.click();
    }
  }
};
