import * as vfs from '../core/vfs.js';
import * as dialogs from '../core/dialogs.js';
import { iconHTML } from '../core/icons.js';
import { joinPath, parentPath, baseName, formatBytes } from '../core/util.js';

export const archiverApp = {
  id: 'archiver',
  name: 'Archiver',
  icon: 'archive',
  defaultSize: [800, 550],

  async launch(body, args, ctx) {
    let currentPath = '/home/user';
    let selectedFiles = new Set();
    let currentItems = [];

    body.innerHTML = `
      <div class="arc-app">
        <div class="app-toolbar">
          <button class="toolbar-btn btn-compress primary">${iconHTML('archive', 14)} Compress to ZIP</button>
          <button class="toolbar-btn btn-extract">${iconHTML('download', 14)} Extract Selected ZIP</button>
          <div style="flex:1"></div>
          <span class="muted" style="font-size:11px" id="arc-status">Ready</span>
        </div>
        
        <div class="arc-split">
          <!-- Left: File Picker -->
          <div class="arc-picker">
            <div class="arc-pathbar" id="arc-path">/home/user</div>
            <div class="arc-list" id="arc-list"></div>
          </div>
          
          <!-- Right: Instructions/Log -->
          <div class="arc-main">
            <div class="arc-header">
              <span>Archive Log</span>
            </div>
            <div class="arc-empty" id="arc-log">
              ${iconHTML('archive', 40)}
              <div>Select files on the left to compress, or select a .zip file to extract.</div>
            </div>
          </div>
        </div>
      </div>
    `;

    const listEl = body.querySelector('#arc-list');
    const pathEl = body.querySelector('#arc-path');
    const logEl = body.querySelector('#arc-log');
    const btnCompress = body.querySelector('.btn-compress');
    const btnExtract = body.querySelector('.btn-extract');
    const statusEl = body.querySelector('#arc-status');

    function log(text) {
      if (logEl.classList.contains('arc-empty')) {
        logEl.className = 'arc-list';
        logEl.innerHTML = '';
      }
      const div = document.createElement('div');
      div.className = 'arc-row';
      div.style.cursor = 'default';
      div.textContent = text;
      logEl.appendChild(div);
      logEl.scrollTop = logEl.scrollHeight;
    }

    async function loadDir(path) {
      try {
        currentPath = path;
        pathEl.textContent = path;
        selectedFiles.clear();
        currentItems = await vfs.list(path);
        renderList();
      } catch (e) {
        dialogs.alert('Error', 'Could not read folder: ' + e.message);
      }
    }

    function renderList() {
      listEl.innerHTML = '';
      
      if (currentPath !== '/') {
        const up = document.createElement('div');
        up.className = 'arc-row';
        up.innerHTML = `${iconHTML('folder', 14)} <span class="name">..</span>`;
        up.onclick = () => loadDir(parentPath(currentPath));
        listEl.appendChild(up);
      }

      currentItems.forEach(item => {
        const row = document.createElement('div');
        row.className = 'arc-row' + (selectedFiles.has(item.name) ? ' selected' : '');
        
        let icon = item.kind === 'dir' ? 'folder' : 'file';
        if (item.name.endsWith('.zip')) icon = 'archive';
        
        row.innerHTML = `
          ${iconHTML(icon, 14)}
          <span class="name">${item.name}</span>
          <span class="size">${item.kind === 'dir' ? '' : formatBytes(item.size)}</span>
        `;
        
        row.onclick = (e) => {
          if (e.ctrlKey || e.metaKey) {
            if (selectedFiles.has(item.name)) selectedFiles.delete(item.name);
            else selectedFiles.add(item.name);
            renderList();
          } else {
            selectedFiles.clear();
            selectedFiles.add(item.name);
            renderList();
          }
        };
        
        row.ondblclick = () => {
          if (item.kind === 'dir') loadDir(joinPath(currentPath, item.name));
        };

        listEl.appendChild(row);
      });
    }

    // --- Compress Logic ---
    btnCompress.onclick = async () => {
      if (selectedFiles.size === 0) {
        return dialogs.alert('Archiver', 'Please select at least one file to compress.');
      }
      if (typeof fflate === 'undefined') {
        return dialogs.alert('Error', 'ZIP library is not loaded.');
      }

      const zipName = await dialogs.prompt('Compress to ZIP', 'Enter archive name:', 'archive.zip');
      if (!zipName) return;
      const finalZipName = zipName.endsWith('.zip') ? zipName : zipName + '.zip';
      
      statusEl.textContent = 'Compressing...';
      const filesToZip = {};
      
      try {
        for (const name of selectedFiles) {
          const path = joinPath(currentPath, name);
          const stat = await vfs.stat(path);
          
          if (stat.kind === 'dir') {
            log(`[Skip] ${name} (Folders not supported yet for compression)`);
            continue;
          }
          
          log(`Reading ${name}...`);
          const blob = await vfs.read(path);
          filesToZip[name] = new Uint8Array(await blob.arrayBuffer());
        }

        if (Object.keys(filesToZip).length === 0) {
          statusEl.textContent = 'Ready';
          return dialogs.alert('Archiver', 'No files were compressed.');
        }

        log(`Creating ZIP archive...`);
        const zipData = fflate.zipSync(filesToZip);
        const zipBlob = new Blob([zipData], { type: 'application/zip' });
        
        const newZipPath = joinPath(currentPath, finalZipName);
        await vfs.write(newZipPath, zipBlob);
        
        log(`Successfully created ${finalZipName} (${formatBytes(zipBlob.size)})`);
        statusEl.textContent = 'Compression complete';
        loadDir(currentPath);
      } catch (e) {
        log(`[Error] ${e.message}`);
        statusEl.textContent = 'Error';
      }
    };

    // --- Extract Logic ---
    btnExtract.onclick = async () => {
      if (selectedFiles.size !== 1) {
        return dialogs.alert('Archiver', 'Please select exactly one .zip file to extract.');
      }
      
      const fileName = Array.from(selectedFiles)[0];
      if (!fileName.endsWith('.zip')) {
        return dialogs.alert('Archiver', 'The selected file is not a ZIP archive.');
      }
      
      if (typeof fflate === 'undefined') {
        return dialogs.alert('Error', 'ZIP library is not loaded.');
      }

      const targetDir = joinPath(currentPath, fileName.replace('.zip', ''));
      statusEl.textContent = 'Extracting...';
      
      try {
        log(`Reading ${fileName}...`);
        const blob = await vfs.read(joinPath(currentPath, fileName));
        const unzipped = fflate.unzipSync(new Uint8Array(await blob.arrayBuffer()));
        
        await vfs.mkdir(targetDir);
        log(`Extracting to ${targetDir}...`);
        
        let count = 0;
        for (const [name, data] of Object.entries(unzipped)) {
          if (name.endsWith('/')) {
            await vfs.mkdir(joinPath(targetDir, name.slice(0, -1)));
          } else {
            const blob = new Blob([data]);
            await vfs.write(joinPath(targetDir, name), blob);
            count++;
          }
        }
        
        log(`Successfully extracted ${count} file(s).`);
        statusEl.textContent = 'Extraction complete';
        loadDir(currentPath);
      } catch (e) {
        log(`[Error] ${e.message}`);
        statusEl.textContent = 'Error';
      }
    };

    // Init
    await loadDir('/home/user');
  }
};
