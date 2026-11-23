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
    const selectedFiles = new Set();
    let currentItems = [];
    let activeWorker = null;
    let activeProg = null;

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
              <div>Select files or folders on the left to compress, or select a .zip file to extract.</div>
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

    // ============================================================
    // Marquee selection (with autoscroll) — restored from the
    // original archiver implementation and matched to the pattern
    // in filemanager.js so both behave identically.
    // ============================================================
    let mq = null;
    const autoScroll = { vx: 0, vy: 0, raf: 0, active: false };

    function stopAutoScroll() {
      autoScroll.active = false;
      autoScroll.vx = autoScroll.vy = 0;
      if (autoScroll.raf) { cancelAnimationFrame(autoScroll.raf); autoScroll.raf = 0; }
    }

    function stepAutoScroll() {
      autoScroll.raf = 0;
      if (!mq || !autoScroll.active) return;
      const { vx, vy } = autoScroll;
      if (!vx && !vy) { autoScroll.active = false; return; }
      if (vy) listEl.scrollTop += vy;
      if (vx) listEl.scrollLeft += vx;
      updateMarquee();
      autoScroll.raf = requestAnimationFrame(stepAutoScroll);
    }

    function updateAutoScrollFrom(ev) {
      if (!mq) return;
      const EDGE = 28;
      const MAX = 18;
      const box = listEl.getBoundingClientRect();
      const axis = (pos, lo, hi) => {
        if (pos < lo + EDGE) return -Math.min(1, (lo + EDGE - pos) / EDGE) * MAX;
        if (pos > hi - EDGE) return Math.min(1, (pos - (hi - EDGE)) / EDGE) * MAX;
        return 0;
      };
      autoScroll.vx = axis(ev.clientX, box.left, box.left + listEl.clientWidth);
      autoScroll.vy = axis(ev.clientY, box.top, box.top + listEl.clientHeight);
      if ((autoScroll.vx || autoScroll.vy) && !autoScroll.active) {
        autoScroll.active = true;
        autoScroll.raf = requestAnimationFrame(stepAutoScroll);
      }
      if (!autoScroll.vx && !autoScroll.vy) stopAutoScroll();
    }

    const updateMarquee = () => {
      if (!mq || !mq.ev) return;
      mq.raf = 0;
      const box = listEl.getBoundingClientRect();
      const ox = box.left - listEl.scrollLeft;
      const oy = box.top - listEl.scrollTop;
      const cx = mq.ev.clientX - ox, cy = mq.ev.clientY - oy;
      const l = Math.min(mq.sx, cx), t = Math.min(mq.sy, cy);
      const r = Math.max(mq.sx, cx), b = Math.max(mq.sy, cy);
      Object.assign(mq.el.style, { left: l + 'px', top: t + 'px', width: r - l + 'px', height: b - t + 'px' });
      for (const it of mq.rects) {
        const hit = !(r < it.l || l > it.r || b < it.t || t > it.b);
        const want = hit || mq.base.has(it.name);
        if (want) selectedFiles.add(it.name);
        else selectedFiles.delete(it.name);
        it.el.classList.toggle('selected', want);
      }
    };

    listEl.addEventListener('pointerdown', (e) => {
      // Only start a marquee from empty space — clicks on a row are handled
      // by row.onclick, which lets a drag starting on a row stay a plain click.
      if (e.button !== 0 || e.target.closest('.arc-row[data-name]')) return;
      const box = listEl.getBoundingClientRect();
      if (e.clientX >= box.left + listEl.clientWidth || e.clientY >= box.top + listEl.clientHeight) return;

      const additive = e.ctrlKey || e.metaKey || e.shiftKey;
      const base = additive ? new Set(selectedFiles) : new Set();
      if (!additive && selectedFiles.size) {
        selectedFiles.clear();
        renderList();
      }

      const ox = box.left - listEl.scrollLeft, oy = box.top - listEl.scrollTop;
      const rects = [...listEl.querySelectorAll('.arc-row[data-name]')].map((el) => {
        const r = el.getBoundingClientRect();
        return { el, name: el.dataset.name, l: r.left - ox, t: r.top - oy, r: r.right - ox, b: r.bottom - oy };
      });
      const el = document.createElement('div');
      el.className = 'arc-marquee';
      listEl.appendChild(el);
      mq = { sx: e.clientX - ox, sy: e.clientY - oy, rects, base, el, raf: 0, ev: null };
      listEl.setPointerCapture(e.pointerId);
    });

    listEl.addEventListener('pointermove', (e) => {
      if (!mq) return;
      mq.ev = e;
      updateAutoScrollFrom(e);
      if (!mq.raf) mq.raf = requestAnimationFrame(updateMarquee);
    });

    const endMarquee = () => {
      if (!mq) return;
      cancelAnimationFrame(mq.raf);
      stopAutoScroll();
      mq.el.remove();
      mq = null;
    };
    listEl.addEventListener('pointerup', endMarquee);
    listEl.addEventListener('pointercancel', endMarquee);

    // ============================================================
    // Compress — walks the selection recursively, feeds the worker
    // streaming. Folders are preserved (including empty ones).
    // ============================================================
    btnCompress.onclick = async () => {
      if (selectedFiles.size === 0) {
        return dialogs.alert('Archiver', 'Select at least one file or folder to compress.');
      }

      const zipName = await dialogs.prompt('Compress to ZIP', 'Enter archive name:', 'archive.zip');
      if (!zipName) return;
      const finalZipName = zipName.endsWith('.zip') ? zipName : zipName + '.zip';

      // 1. Walk the selection to build a flat list of entries.
      //    Folders become directory entries (path ending in "/") so
      //    empty ones survive the round trip. Files carry their real
      //    source path + size for streaming.
      statusEl.textContent = 'Scanning…';
      const entries = [];
      const walk = async (nd, prefix, dir) => {
        const fullName = (prefix ? prefix + '/' : '') + nd.name;
        if (nd.kind === 'dir') {
          entries.push({ name: fullName + '/', path: null, size: 0, isDir: true });
          const items = await vfs.list(joinPath(dir, nd.name));
          for (const c of items) await walk(c, fullName, joinPath(dir, nd.name));
        } else if (nd.kind === 'file') {
          entries.push({ name: fullName, path: joinPath(dir, nd.name), size: nd.size || 0, isDir: false });
        }
      };
      try {
        for (const name of selectedFiles) {
          try {
            const stat = await vfs.stat(joinPath(currentPath, name));
            await walk({ name, kind: stat.kind, size: stat.size }, '', currentPath);
          } catch (e) {
            log(`[Skip] ${name}: ${e.message.replace(/^E[A-Z]+: /, '')}`);
          }
        }
      } catch (e) {
        statusEl.textContent = 'Error';
        log('[Error] ' + e.message);
        return;
      }

      const fileEntries = entries.filter((e) => !e.isDir);
      if (!fileEntries.length) {
        statusEl.textContent = 'Ready';
        return dialogs.alert('Archiver', 'The selection contains no files — only empty folders or shortcuts.');
      }

      const totalBytes = fileEntries.reduce((s, e) => s + e.size, 0);
      statusEl.textContent = 'Compressing…';
      const prog = dialogs.progress(
        `Compressing ${fileEntries.length} file${fileEntries.length === 1 ? '' : 's'} to ${finalZipName}`
      );
      activeProg = prog;

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

        let processedBytes = 0;
        for (const e of entries) {
          if (prog.cancelled) throw new Error('cancelled');

          if (e.isDir) {
            worker.postMessage({ type: 'add-start', name: e.name, method: ZIP_METHOD.STORED });
            worker.postMessage({ type: 'add-end' });
            continue;
          }

          const method = shouldStore(e.name) ? ZIP_METHOD.STORED : ZIP_METHOD.DEFLATE;
          worker.postMessage({ type: 'add-start', name: e.name, method });

          const blob = await vfs.read(e.path);
          const reader = blob.stream().getReader();
          for (;;) {
            if (prog.cancelled) throw new Error('cancelled');
            const { value, done } = await reader.read();
            if (done) break;
            processedBytes += value.byteLength;
            worker.postMessage({ type: 'add-chunk', data: value.buffer }, [value.buffer]);
            prog.update(
              `${e.name} · ${formatBytes(processedBytes)} of ${formatBytes(totalBytes)}`,
              totalBytes ? Math.min(1, processedBytes / totalBytes) : 0
            );
          }
          worker.postMessage({ type: 'add-end' });
        }

        worker.postMessage({ type: 'finish' });
        const { chunks } = await resultPromise;
        prog.close();
        activeProg = null;
        worker.terminate();
        worker = null;
        activeWorker = null;

        const blob = new Blob(chunks, { type: 'application/zip' });
        await vfs.write(joinPath(currentPath, finalZipName), blob);

        log(`Created ${finalZipName} · ${formatBytes(blob.size)} · ${fileEntries.length} file${fileEntries.length === 1 ? '' : 's'}`);
        statusEl.textContent = 'Compression complete';
        await loadDir(currentPath);
      } catch (err) {
        if (worker) { try { worker.terminate(); } catch {} }
        activeWorker = null;
        if (activeProg === prog) { prog.close(); activeProg = null; }
        statusEl.textContent = 'Error';
        if (err.message === 'cancelled') {
          log('[Cancelled] Compression stopped');
        } else {
          log('[Error] ' + err.message);
          dialogs.alert('Compression failed', err.message);
        }
      }
    };

    // ============================================================
    // Extract — delegated to files.js::extractArchive.
    // ============================================================
    btnExtract.onclick = async () => {
      if (selectedFiles.size !== 1) {
        return dialogs.alert('Archiver', 'Please select exactly one .zip file to extract.');
      }
      const fileName = Array.from(selectedFiles)[0];
      if (!fileName.endsWith('.zip')) {
        return dialogs.alert('Archiver', 'The selected file is not a ZIP archive.');
      }

      statusEl.textContent = 'Extracting…';
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
      endMarquee();
      if (activeWorker) {
        try { activeWorker.terminate(); } catch {}
        activeWorker = null;
      }
      if (activeProg) {
        try { activeProg.close(); } catch {}
        activeProg = null;
      }
    });

    await loadDir('/home/user');
  }
};
