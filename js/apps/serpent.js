import * as vfs from '../core/vfs.js';
import * as dialogs from '../core/dialogs.js';
import { iconHTML } from '../core/icons.js';
import { CodeEditor } from '../core/code-editor.js';
import * as dialogs from '../core/dialogs.js';
import { openWindow } from '../core/wm.js';
import { initPython, getPython } from '../core/python-runtime.js';

const PROJECT_DIR = '/home/user/Projects';

export const serpentApp = {
  id: 'serpent',
  name: 'Serpent',
  icon: 'python',
  defaultSize: [900, 600],

  async launch(body, args, ctx) {
    let pyLoading = false;
    let openFiles = new Map(); 
    let activeFile = null;
    let projectTreeEl = null;
    let tabsEl = null;
    let editorContainer = null;
    
    // Output and REPL elements
    let replLog = null;
    let replInput = null;
    let outputLog = null;

    // Ensure project dir exists
    if (!(await vfs.exists(PROJECT_DIR))) {
      await vfs.mkdir(PROJECT_DIR);
      await vfs.write(`${PROJECT_DIR}/main.py`, 'def greet(name):\n    return f"Hello, {name}!"\n\nprint(greet("Developer"))\n');
    }

    body.innerHTML = `
      <div class="ide-app">
        <div class="ide-toolbar">
          <button class="toolbar-btn btn-run primary">${iconHTML('play', 14)} Run File</button>
          <button class="toolbar-btn btn-save" disabled>${iconHTML('file-text', 14)} Save</button>
          <div class="toolbar-sep"></div>
          <button class="toolbar-btn btn-new">${iconHTML('file-plus', 14)} New File</button>
          <button class="toolbar-btn btn-clear">${iconHTML('trash', 14)} Clear All</button>
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
            <div class="code-editor-container" id="serpent-editor"></div>
            
            <!-- Split Bottom Panel -->
            <div class="ide-bottom-panel" style="flex-direction: row; height: 250px; flex-shrink: 0;">
              
              <!-- Left: REPL -->
              <div class="ide-main" style="flex: 1; min-width: 0; border-right: 1px solid var(--bd-soft);">
                <div class="ide-bottom-header">
                  <span>Interactive Console</span>
                </div>
                <div class="ide-console" id="serpent-repl-log" style="flex: 1; overflow-y: auto; white-space: pre-wrap;"></div>
                <div class="repl-input-line">
                  <span class="repl-prompt">>>></span>
                  <input type="text" id="serpent-repl-input" class="repl-input" autocomplete="off" spellcheck="false" placeholder="Type Python code and press Enter...">
                </div>
              </div>

              <!-- Right: Output -->
              <div class="ide-main" style="flex: 1; min-width: 0;">
                <div class="ide-bottom-header">
                  <span>Output</span>
                  <span class="muted" id="serpent-console-status">Idle</span>
                </div>
                <div class="ide-console" id="serpent-output-log" style="flex: 1; overflow-y: auto;"></div>
              </div>
              
            </div>
          </div>
        </div>
      </div>
    `;

    projectTreeEl = body.querySelector('#serpent-tree');
    tabsEl = body.querySelector('#serpent-tabs');
    editorContainer = body.querySelector('#serpent-editor');
    
    replLog = body.querySelector('#serpent-repl-log');
    replInput = body.querySelector('#serpent-repl-input');
    outputLog = body.querySelector('#serpent-output-log');
    
    const btnRun = body.querySelector('.btn-run');
    const btnSave = body.querySelector('.btn-save');
    const btnNew = body.querySelector('.btn-new');
    const btnClear = body.querySelector('.btn-clear');
    const statusEl = body.querySelector('#serpent-status');
    const consoleStatus = body.querySelector('#serpent-console-status');

    // --- Output Loggers ---
    function logOutput(text, isError = false) {
      const div = document.createElement('div');
      if (isError) div.className = 'ide-console-error';
      div.textContent = text;
      outputLog.appendChild(div);
      outputLog.scrollTop = outputLog.scrollHeight;
    }

    function logRepl(text, isError = false) {
      const div = document.createElement('div');
      if (isError) div.className = 'ide-console-error';
      div.textContent = text;
      replLog.appendChild(div);
      replLog.scrollTop = replLog.scrollHeight;
    }

    // --- File System ---
    async function loadTree() {
      projectTreeEl.innerHTML = '';
      try {
        const items = await vfs.list(PROJECT_DIR);
        for (const item of items) {
          if (item.kind === 'dir') continue;
          const el = document.createElement('div');
          el.className = 'ide-tree-item';
          el.innerHTML = `${iconHTML('file-text', 14)} ${item.name}`;
          el.onclick = () => openFile(item.name);
          if (activeFile === item.name) el.classList.add('active');
          projectTreeEl.appendChild(el);
        }
      } catch (e) {
        logOutput('Error reading project: ' + e.message, true);
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

        const tab = document.createElement('div');
        tab.className = 'ide-tab';
        tab.innerHTML = `${iconHTML('file-text', 12)} ${filename}`;
        tab.onclick = () => switchTab(filename);
        tabsEl.appendChild(tab);

        const edWrap = document.createElement('div');
        edWrap.className = 'code-editor-wrapper';
        edWrap.style.display = 'none';
        editorContainer.appendChild(edWrap);

               let editor;
        try {
          editor = new CodeEditor(edWrap, {
            language: 'python',
            value: text,
            onChange: () => {
              if (!openFiles.has(filename)) return;
              openFiles.get(filename).dirty = true;
              tab.innerHTML = `${iconHTML('file-text', 12)} ${filename} *`;
              btnSave.disabled = false;
            }
          });
        } catch (err) {
          if (err.name === 'EditorTooLargeError') {
            tab.remove();
            edWrap.remove();
            dialogs.alert('File too large', `"${filename}" — ${err.message}\n\n` +
              'For viewing large text files, open the file in Notepad, which supports up to 1 GB in read-only mode.');
            return;
          }
          throw err;
        }

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
        logOutput(`Saved ${activeFile}`);
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
        logOutput('No file open to run.', true);
        return;
      }
      
      outputLog.innerHTML = '';
      consoleStatus.textContent = 'Running...';
      btnRun.disabled = true;
      
      try {
        let py = getPython();
        if (!py) {
          if (!pyLoading) {
            statusEl.textContent = 'Loading Python (WASM)...';
            logOutput('Python runtime is still loading (or failed during boot). Please wait...');
            pyLoading = true;
            await initPython();
            pyLoading = false;
          } else {
            await new Promise(r => setTimeout(r, 500));
          }
          py = getPython();
        }
        
        py.setStdout({ batched: (str) => logOutput(str) });
        py.setStderr({ batched: (str) => logOutput(str, true) });
        
        const code = openFiles.get(activeFile).editor.getValue();
        await py.runPythonAsync(code);
        
        consoleStatus.textContent = 'Finished';
      } catch (err) {
        logOutput(err.message, true);
        consoleStatus.textContent = 'Error';
      } finally {
        btnRun.disabled = false;
        statusEl.textContent = 'Ready';
      }
    }

    // --- REPL Input Logic ---
    replInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const code = replInput.value;
        if (!code.trim()) return;
        
        replInput.value = '';
        logRepl(`>>> ${code}`);
        
        try {
          let py = getPython();
          if (!py) {
            logRepl('Python runtime is loading...', true);
            await initPython();
            py = getPython();
          }
          
          py.setStdout({ batched: (str) => logRepl(str) });
          py.setStderr({ batched: (str) => logRepl(str, true) });
          
          const result = await py.runPythonAsync(code);
          if (result !== undefined && result !== null) {
             logRepl(String(result));
          }
        } catch (err) {
          logRepl(err.message, true);
        }
      }
    });

    // --- Events ---
    btnSave.onclick = saveFile;
    btnNew.onclick = newFile;
    btnRun.onclick = runCode;
    btnClear.onclick = () => { 
      outputLog.innerHTML = ''; 
      replLog.innerHTML = ''; 
    };

    ctx.onCleanup(() => {});

    // Init
    await loadTree();
    if (projectTreeEl.firstElementChild) {
      projectTreeEl.firstElementChild.click();
    }
  }
};
