import * as vfs from '../core/vfs.js';
import * as dialogs from '../core/dialogs.js';
import { iconHTML } from '../core/icons.js';
import { esc, joinPath, parentPath, formatBytes } from '../core/util.js';
import { iconFor, extractArchive } from '../core/files.js';
import { ZIP_METHOD } from '../core/zip-writer.js';
import { shouldStore } from '../core/zip.js';

export const archiverApp = {
  id: 'archiver',
  name: 'Archiver',
  icon: 'archive',
  defaultSize: [800, 550],

  async launch(body, args, ctx) {
    let currentPath = '/home/user';
    let selectedFiles = new Set();
    let currentItems = [];
    let activeWorker = null;

    body.innerHTML = `
      <div class="arc-app">
        <div class="app-toolbar">
          <button class="toolbar-btn btn-compress primary">${iconHTML('archive', 14)} Compress to ZIP</button>
          <button class="toolbar-btn btn-extract">${iconHTML('download', 14)} Extract Selected ZIP</button>
          <div style="flex:1"></div>
          <span class="muted" style="font-size:11px" id="arc-status">Ready</span>
        </div>

        <div class="arc-split">
          <div class="arc-picker">
            <div class="arc-pathbar" id="arc-path">/home/user</div>
            <div class="arc-list" id="arc-list"></div>
          </div>

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
        row.dataset.name = item.name;

        row.innerHTML = `
          ${iconHTML(iconFor(item), 14)}
          <span class="name">${esc(item.name)}</span>
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

    // ---------- Compress ----------
    // Runs entirely in a Web Worker. The main thread only:
    //   · reads chunk-by-chunk from the VFS (IndexedDB is already async)
    //   · transfers each chunk's buffer to the worker (zero-copy)
    //   · updates the progress dialog
    // The worker deflates (for text) or copies through (for media) — either
    // way the main thread never blocks and the UI stays responsive.
    btnCompress.onclick = async () => {
      if (selectedFiles.size === 0) {
        return dialogs.alert('Archiver', 'Please select at least one file to compress.');
      }

      const zipName = await dialogs.prompt('Compress to ZIP', 'Enter archive name:', 'archive.zip');
      if (!zipName) return;
      const finalZipName = zipName.endsWith('.zip') ? zipName : zipName + '.zip';

      // Resolve selected files. Folders are skipped — recursive walk is a v2
      // feature and the ARCHIVER UI already reports this clearly.
      const files = [];
      for (const name of selectedFiles) {
        const path = joinPath(currentPath, name);
        let stat;
        try { stat = await vfs.stat(path); }
        catch (e) {
          log(`[Skip] ${name} (${e.message.replace(/^E[A-Z]+: /, '')})`);
          continue;
        }
        if (stat.kind === 'dir') {
          log(`[Skip] ${name} (folders not supported — select individual files)`);
          continue;
        }
        files.push({ name, path, size: stat.size || 0 });
      }

      if (files.length === 0) {
        return dialogs.alert('Archiver', 'No compressible files were selected.');
      }

      const totalBytes = files.reduce((s, f) => s + f.size, 0);
      statusEl.textContent = 'Compressing...';
      const prog = dialogs.progress(`Compressing ${files.length} file${files.length === 1 ? '' : 's'} to ${finalZipName}`);

      let worker;
      try {
        worker = new Worker(new URL('../core/zip-worker.js', import.meta.url), { type: 'module' });
        activeWorker = worker;

        const resultPromise = new Promise((resolve, reject) => {
          worker.onmessage = (ev) => {
            const msg = ev.data;
            if (msg.type === 'done') resolve(msg);
            else if (msg.type === 'error') reject(new Error(msg.message || 'Worker error'));
          };
          worker.onerror = (err) => reject(new Error(err.message || 'Worker crashed'));
        });

        let readBytes = 0;
        for (const f of files) {
          if (prog.cancelled) throw new Error('cancelled');

          const method = shouldStore(f.name) ? ZIP_METHOD.STORED : ZIP_METHOD.DEFLATE;
          worker.postMessage({ type: 'add-start', name: f.name, method });

          const blob = await vfs.read(f.path);
          const reader = blob.stream().getReader();
          for (;;) {
            if (prog.cancelled) throw new Error('cancelled');
            const { value, done } = await reader.read();
            if (done) break;
            readBytes += value.byteLength;
            // Transfer the buffer to the worker — no copy, no retained memory.
            worker.postMessage({ type: 'add-chunk', data: value.buffer }, [value.buffer]);
            prog.update(
              `${f.name} · ${formatBytes(readBytes)} of ${formatBytes(totalBytes)}`,
              totalBytes ? Math.min(1, readBytes / totalBytes) : 0
            );
          }
          worker.postMessage({ type: 'add-end' });
        }

        worker.postMessage({ type: 'finish' });
        const { chunks, bytes } = await resultPromise;

        prog.close();
        worker.terminate();
        worker = null;
        activeWorker = null;

        // Lazy composite — no data is copied here.
        const blob = new Blob(chunks, { type: 'application/zip' });
        await vfs.write(joinPath(currentPath, finalZipName), blob);

        log(`Created ${finalZipName} · ${formatBytes(blob.size)} · ${files.length} file${files.length === 1 ? '' : 's'}`);
        statusEl.textContent = 'Compression complete';
        await loadDir(currentPath);
      } catch (err) {
        if (worker) { try { worker.terminate(); } catch {} }
        activeWorker = null;
        prog.close();
        statusEl.textContent = 'Error';
        if (err.message === 'cancelled') {
          log('[Cancelled] Compression stopped');
        } else {
          log('[Error] ' + err.message);
          dialogs.alert('Compression failed', err.message);
        }
      }
    };

    // ---------- Extract ----------
    // Delegated to files.js::extractArchive, which already streams entries
    // from the .zip, checks free disk space, guards against zip-slip, and
    // shows its own progress dialog with a cancel button.
    btnExtract.onclick = async () => {
      if (selectedFiles.size !== 1) {
        return dialogs.alert('Archiver', 'Please select exactly one .zip file to extract.');
      }
      const fileName = Array.from(selectedFiles)[0];
      if (!fileName.endsWith('.zip')) {
        return dialogs.alert('Archiver', 'The selected file is not a ZIP archive.');
      }

      statusEl.textContent = 'Extracting...';
      try {
        const res = await extractArchive(joinPath(currentPath, fileName), { here: false });
        if (res) {
          log(`Extracted ${fileName} → ${res.dir}`);
          statusEl.textContent = 'Extraction complete';
          await loadDir(currentPath);
        } else {
          statusEl.textContent = 'Ready';
        }
      } catch (err) {
        statusEl.textContent = 'Error';
        log('[Error] ' + err.message);
      }
    };

    ctx.onCleanup(() => {
      if (activeWorker) {
        try { activeWorker.terminate(); } catch {}
        activeWorker = null;
      }
    });

    await loadDir('/home/user');
  }
};
