import * as vfs from '../core/vfs.js';
import * as dialogs from '../core/dialogs.js';
import { iconHTML } from '../core/icons.js';
import { CodeEditor } from '../core/code-editor.js';
import { extOf } from '../core/util.js';

const PROJECT_DIR = '/home/user/Projects/Web';

export const webcraftApp = {
  id: 'webcraft',
  name: 'WebCraft',
  icon: 'web',
  defaultSize: [1000, 650],

  async launch(body, args, ctx) {
    let openFiles = new Map();
    let activeFile = null;
    let projectTreeEl = null;
    let tabsEl = null;
    let editorContainer = null;
    let previewContainer = null;
    let previewIframe = null;
    let isPreviewMinimized = false;

    // Ensure project dir and default files exist
    if (!(await vfs.exists(PROJECT_DIR))) {
      await vfs.mkdir(PROJECT_DIR);
      await vfs.write(`${PROJECT_DIR}/index.html`, `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>Hello, WebCraft!</h1>
  <p>Edit the files on the left to see changes here.</p>
  <script src="script.js"></script>
</body>
</html>`);
      await vfs.write(`${PROJECT_DIR}/style.css`, `body {
  font-family: "Segoe UI", sans-serif;
  background: #1a1a1a;
  color: #ffffff;
  padding: 20px;
}
h1 { font-weight: 300; }`);
      await vfs.write(`${PROJECT_DIR}/script.js`, `console.log("WebCraft loaded.");`);
    }

    // Replace the body.innerHTML in webcraft.js with this:
    body.innerHTML = `
      <div class="ide-app">
        <div class="ide-toolbar">
          <button class="toolbar-btn btn-run primary">${iconHTML('refresh', 14)} Refresh Preview</button>
          <button class="toolbar-btn btn-save" disabled>${iconHTML('file-text', 14)} Save</button>
          <div class="toolbar-sep"></div>
          <button class="toolbar-btn btn-new">${iconHTML('file-plus', 14)} New File</button>
          <button class="toolbar-btn btn-toggle-preview" title="Toggle Preview">${iconHTML('grid', 14)} Hide Preview</button>
          <div style="flex:1"></div>
          <span class="muted" style="font-size:11px" id="webcraft-status">Ready</span>
        </div>
        
        <div class="ide-split" style="flex-direction: row;">
          <!-- Left: File Tree -->
          <div class="ide-sidebar" style="flex: 0 0 180px;">
            <div class="ide-sidebar-header">Project: Web</div>
            <div id="webcraft-tree"></div>
          </div>
          
          <!-- Middle: Editor -->
          <div class="ide-main" id="webcraft-editor-pane" style="flex: 1 1 50%; min-width: 0; border-right: 1px solid var(--bd-soft);">
            <div class="ide-tabs" id="webcraft-tabs"></div>
            <div class="code-editor-container" id="webcraft-editor"></div>
          </div>

          <!-- Right: Preview -->
          <div class="ide-main" id="webcraft-preview-pane" style="flex: 1 1 50%; min-width: 0; background: var(--paper);">
            <div class="ide-bottom-header" style="background: var(--surface); border-bottom: 1px solid var(--bd-soft);">
              <span>Preview</span>
            </div>
            <iframe id="webcraft-preview" class="ide-preview" sandbox="allow-scripts allow-modals"></iframe>
          </div>
        </div>
      </div>
    `;

    projectTreeEl = body.querySelector('#webcraft-tree');
    tabsEl = body.querySelector('#webcraft-tabs');
    editorContainer = body.querySelector('#webcraft-editor');
    previewContainer = body.querySelector('#webcraft-preview-pane');
    previewIframe = body.querySelector('#webcraft-preview');
    
    const btnRun = body.querySelector('.btn-run');
    const btnSave = body.querySelector('.btn-save');
    const btnNew = body.querySelector('.btn-new');
    const btnTogglePreview = body.querySelector('.btn-toggle-preview');
    const statusEl = body.querySelector('#webcraft-status');

    // --- Preview Toggle Logic ---
    btnTogglePreview.onclick = () => {
      isPreviewMinimized = !isPreviewMinimized;
      if (isPreviewMinimized) {
        previewContainer.style.display = 'none';
        editorContainer.parentElement.style.flex = '1 1 100%'; // Editor takes full width
        editorContainer.parentElement.style.borderRight = 'none';
        btnTogglePreview.innerHTML = `${iconHTML('grid', 14)} Show Preview`;
      } else {
        previewContainer.style.display = 'flex';
        editorContainer.parentElement.style.flex = '1 1 50%';
        editorContainer.parentElement.style.borderRight = '1px solid var(--bd-soft)';
        btnTogglePreview.innerHTML = `${iconHTML('grid', 14)} Hide Preview`;
      }
    };

    // --- File System ---
    async function loadTree() {
      projectTreeEl.innerHTML = '';
      try {
        const items = await vfs.list(PROJECT_DIR);
        for (const item of items) {
          if (item.kind === 'dir') continue;
          const el = document.createElement('div');
          el.className = 'ide-tree-item';
          let icon = 'file';
          if (item.name.endsWith('.html')) icon = 'file-text';
          else if (item.name.endsWith('.css')) icon = 'file-text';
          else if (item.name.endsWith('.js')) icon = 'file-text';
          
          el.innerHTML = `${iconHTML(icon, 14)} ${item.name}`;
          el.onclick = () => openFile(item.name);
          if (activeFile === item.name) el.classList.add('active');
          projectTreeEl.appendChild(el);
        }
      } catch (e) {
        console.error('Error reading project:', e);
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
        const ext = extOf(filename);
        
        let lang = 'text';
        if (ext === 'html') lang = 'html';
        else if (ext === 'css') lang = 'css';
        else if (ext === 'js') lang = 'js';

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
          language: lang,
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
        
        if (filename === 'index.html' || openFiles.size === 1) {
          updatePreview();
        }
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
        statusEl.textContent = `Saved ${activeFile}`;
        
        updatePreview();
      } catch (e) {
        if (e.message.includes('ENOSPC')) {
          dialogs.alert('Disk Full', 'The browser storage limit has been reached. Please delete some files or click "Request More Space" in the File Manager.');
        } else {
          dialogs.alert('Error', 'Could not save: ' + e.message);
        }
      }
    }

    async function newFile() {
      const name = await dialogs.prompt('New File', 'Filename (e.g., about.html):', 'new.html');
      if (!name) return;
      
      const path = `${PROJECT_DIR}/${name}`;
      if (await vfs.exists(path)) {
        dialogs.alert('Error', 'File already exists.');
        return;
      }
      
      await vfs.write(path, '');
      await loadTree();
      openFile(name);
    }

    async function updatePreview() {
      statusEl.textContent = 'Updating preview...';
      
      if (!(await vfs.exists(`${PROJECT_DIR}/index.html`))) {
        previewIframe.srcdoc = '<body style="font-family:sans-serif;padding:20px;color:#666;">No index.html found in project.</body>';
        statusEl.textContent = 'No index.html';
        return;
      }

      try {
        let html = '';
        
        if (openFiles.has('index.html') && openFiles.get('index.html').dirty) {
          html = openFiles.get('index.html').editor.getValue();
        } else {
          const blob = await vfs.read(`${PROJECT_DIR}/index.html`);
          html = await blob.text();
        }

        // 1. Inline CSS
        const cssRegex = /<link[^>]*href=["']([^"']+\.css)["'][^>]*>/gi;
        let match;
        while ((match = cssRegex.exec(html)) !== null) {
          const cssFile = match[1];
          let css = '';
          if (openFiles.has(cssFile) && openFiles.get(cssFile).dirty) {
            css = openFiles.get(cssFile).editor.getValue();
          } else {
            try {
              const b = await vfs.read(`${PROJECT_DIR}/${cssFile}`);
              css = await b.text();
            } catch {}
          }
          html = html.replace(match[0], `<style>\n${css}\n</style>`);
        }

        // 2. Inline JS
        const jsRegex = /<script[^>]*src=["']([^"']+\.js)["'][^>]*>\s*<\/script>/gi;
        while ((match = jsRegex.exec(html)) !== null) {
          const jsFile = match[1];
          let js = '';
          if (openFiles.has(jsFile) && openFiles.get(jsFile).dirty) {
            js = openFiles.get(jsFile).editor.getValue();
          } else {
            try {
              const b = await vfs.read(`${PROJECT_DIR}/${jsFile}`);
              js = await b.text();
            } catch {}
          }
          html = html.replace(match[0], `<script>\n${js}\n</script>`);
        }

        previewIframe.srcdoc = html;
        statusEl.textContent = 'Preview updated';
      } catch (err) {
        console.error(err);
        statusEl.textContent = 'Preview error';
      }
    }

    // --- Events ---
    btnSave.onclick = saveFile;
    btnNew.onclick = newFile;
    btnRun.onclick = updatePreview;

    // Init
    await loadTree();
    if (await vfs.exists(`${PROJECT_DIR}/index.html`)) {
      openFile('index.html');
    } else if (projectTreeEl.firstElementChild) {
      projectTreeEl.firstElementChild.click();
    }
  }
};
