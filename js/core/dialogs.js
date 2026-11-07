import * as vfs from './vfs.js';
import { iconHTML } from './icons.js';
import { esc, extOf, formatBytes, joinPath, parentPath } from './util.js';

const layer = document.getElementById('dialog-layer');

/** `contentHTML` / `buttonsHTML` are trusted markup; callers must esc() any user text. */
function createModal(title, contentHTML, buttonsHTML) {
  const previouslyFocused = document.activeElement;

  const backdrop = document.createElement('div');
  backdrop.className = 'dialog-backdrop';

  const box = document.createElement('div');
  box.className = 'window focused dialog-box';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.innerHTML = `
    <div class="window-titlebar">
      <div class="window-title">${esc(title)}</div>
      <div class="window-buttons">
        <button class="window-btn window-btn-close" title="Close">
          <svg class="icon" aria-hidden="true"><use href="#i-close"/></svg>
        </button>
      </div>
    </div>
    <div class="window-body dialog-content">${contentHTML}</div>
    <div class="dialog-footer">${buttonsHTML}</div>
  `;

  backdrop.appendChild(box);
  layer.appendChild(backdrop);
  layer.hidden = false;

  const cancel = () => (box.querySelector('.btn-cancel') ? box.querySelector('.btn-cancel').click() : close());

  const onKeyDown = (e) => {
    if (e.key === 'Escape' && layer.lastElementChild === backdrop) {
      e.stopPropagation();
      cancel();
    }
  };
  document.addEventListener('keydown', onKeyDown, true);

  function close() {
    document.removeEventListener('keydown', onKeyDown, true);
    backdrop.remove();
    if (!layer.childElementCount) layer.hidden = true;
    previouslyFocused?.focus?.({ preventScroll: true });
  }

  box.querySelector('.window-btn-close').addEventListener('click', cancel);

  return {
    box, close,
    content: box.querySelector('.dialog-content'),
    footer: box.querySelector('.dialog-footer')
  };
}

// ---- Toasts ----

const toastLayer = document.getElementById('toast-layer');

/** Small non-blocking notification. `danger` renders white-on-black with an accent edge. */
export function toast(message, { danger = false, timeout = 4000 } = {}) {
  if (!toastLayer) return;
  const el = document.createElement('div');
  el.className = 'toast' + (danger ? ' toast--danger' : '');
  el.innerHTML = `${iconHTML(danger ? 'warning' : 'info', 16)}<div></div>`;
  el.lastElementChild.textContent = message;
  toastLayer.appendChild(el);
  while (toastLayer.childElementCount > 4) toastLayer.firstElementChild.remove();
  const remove = () => el.remove();
  el.addEventListener('click', remove);
  setTimeout(remove, timeout);
}

// ---- Standard Dialogs ----

const messageBody = (message) => `<div class="app-form"><p class="dialog-message">${esc(message)}</p></div>`;

export function alert(title, message) {
  return new Promise((resolve) => {
    const { close, footer } = createModal(title, messageBody(message),
      '<button class="app-btn primary btn-ok">OK</button>');
    const ok = footer.querySelector('.btn-ok');
    ok.addEventListener('click', () => { close(); resolve(); });
    ok.focus();
  });
}

export function confirm(title, message, okLabel = 'OK') {
  return new Promise((resolve) => {
    const { close, footer } = createModal(title, messageBody(message), `
      <button class="app-btn btn-cancel">Cancel</button>
      <button class="app-btn primary btn-ok">${esc(okLabel)}</button>`);
    footer.querySelector('.btn-cancel').addEventListener('click', () => { close(); resolve(false); });
    const ok = footer.querySelector('.btn-ok');
    ok.addEventListener('click', () => { close(); resolve(true); });
    ok.focus();
  });
}

export function prompt(title, message, defaultValue = '') {
  return new Promise((resolve) => {
    const { close, footer, content } = createModal(title, `
      <div class="app-form">
        <p class="dialog-message">${esc(message)}</p>
        <input class="app-input" type="text" value="${esc(defaultValue)}">
      </div>`, `
      <button class="app-btn btn-cancel">Cancel</button>
      <button class="app-btn primary btn-ok">OK</button>`);

    const input = content.querySelector('input');
    requestAnimationFrame(() => {
      input.focus();
      // Select the name but not the extension, like most file managers.
      const dot = defaultValue.lastIndexOf('.');
      input.setSelectionRange(0, dot > 0 ? dot : defaultValue.length);
    });

    const submit = () => { close(); resolve(input.value); };
    footer.querySelector('.btn-cancel').addEventListener('click', () => { close(); resolve(null); });
    footer.querySelector('.btn-ok').addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
    });
  });
}

/**
 * Modal progress dialog for long jobs. Returns { update(text, fraction?), close(), cancelled }.
 * `cancelled` flips to true when the user presses Cancel (or Esc); the job should poll it.
 */
export function progress(title) {
  const { close, footer, content } = createModal(title, `
    <div class="app-form">
      <p class="dialog-message prog-text">Preparing…</p>
      <div class="prog-bar"><div class="prog-fill"></div></div>
    </div>`, '<button class="app-btn btn-cancel">Cancel</button>');
  const text = content.querySelector('.prog-text');
  const fill = content.querySelector('.prog-fill');
  const cancelBtn = footer.querySelector('.btn-cancel');
  const api = {
    cancelled: false,
    close,
    update(message, fraction) {
      if (api.cancelled) return;
      text.textContent = message;
      if (typeof fraction === 'number') fill.style.width = Math.max(0, Math.min(1, fraction)) * 100 + '%';
    }
  };
  cancelBtn.addEventListener('click', () => {
    api.cancelled = true;
    cancelBtn.disabled = true;
    text.textContent = 'Cancelling…';
  });
  return api;
}

// ---- File Picker ----

/** `exts` (optional Set of lowercase extensions) limits which files are listed in 'open' mode. */
export function filePicker(title, mode = 'open', defaultPath = '/home/user', defaultFilename = '', exts = null) {
  return new Promise((resolve) => {
    const isSave = mode === 'save';
    let cwd = defaultPath;
    let selected = null; // { name, kind }

    const { close, footer, content } = createModal(title, `
      <div class="picker">
        <div class="picker-bar">
          <button class="toolbar-btn btn-up" title="Up"><svg class="icon"><use href="#i-up"/></svg></button>
          <button class="toolbar-btn btn-newdir" title="New Folder"><svg class="icon"><use href="#i-folder-plus"/></svg></button>
          <div class="picker-path truncate"></div>
        </div>
        <div class="picker-list app-list"></div>
        ${isSave ? `
        <div class="picker-save">
          <label for="picker-filename">File name</label>
          <input id="picker-filename" class="app-input picker-filename" type="text" value="${esc(defaultFilename)}">
        </div>` : ''}
      </div>`, `
      <button class="app-btn btn-cancel">Cancel</button>
      <button class="app-btn primary btn-ok" disabled>${isSave ? 'Save' : 'Open'}</button>`);

    const listEl = content.querySelector('.picker-list');
    const pathEl = content.querySelector('.picker-path');
    const okBtn = footer.querySelector('.btn-ok');
    const nameInput = content.querySelector('.picker-filename');

    const updateOk = () => {
      okBtn.disabled = isSave ? !nameInput.value.trim() : !selected || selected.kind === 'dir';
    };

    const go = (path) => {
      cwd = path;
      selected = null;
      if (nameInput && !nameInput.value.trim()) updateOk();
      render();
    };

    async function render() {
      pathEl.textContent = pathEl.title = cwd;
      updateOk();
      try {
        let items = await vfs.list(cwd);
        if (exts && !isSave) items = items.filter((it) => it.kind === 'dir' || exts.has(extOf(it.name)));
        listEl.innerHTML = items.map((it) => `
          <div class="app-list-row${selected?.name === it.name ? ' selected' : ''}" data-name="${esc(it.name)}" data-kind="${it.kind}">
            <div class="row-name">${iconHTML(it.kind === 'dir' ? 'folder' : 'file')}<span>${esc(it.name)}</span></div>
            <div class="row-meta">${it.kind === 'dir' ? '' : formatBytes(it.size)}</div>
          </div>`).join('') || '<div class="app-empty">This folder is empty</div>';
      } catch (err) {
        listEl.innerHTML = `<div class="app-empty">${esc(err.message)}</div>`;
      }
    }

    listEl.addEventListener('click', (e) => {
      const row = e.target.closest('[data-name]');
      if (!row) return;
      listEl.querySelector('.selected')?.classList.remove('selected');
      row.classList.add('selected');
      selected = { name: row.dataset.name, kind: row.dataset.kind };
      if (nameInput && selected.kind === 'file') nameInput.value = selected.name;
      updateOk();
    });
    listEl.addEventListener('dblclick', (e) => {
      const row = e.target.closest('[data-name]');
      if (!row) return;
      if (row.dataset.kind === 'dir') go(joinPath(cwd, row.dataset.name));
      else if (!isSave) okBtn.click();
    });

    content.querySelector('.btn-up').addEventListener('click', () => { if (cwd !== '/') go(parentPath(cwd)); });
    content.querySelector('.btn-newdir').addEventListener('click', async () => {
      const name = (await prompt('New Folder', 'Folder name:'))?.trim();
      if (!name) return;
      try {
        await vfs.mkdir(joinPath(cwd, name));
        selected = { name, kind: 'dir' };
        await render();
      } catch (err) {
        alert('Error', 'Could not create folder: ' + err.message);
      }
    });

    nameInput?.addEventListener('input', updateOk);
    nameInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !okBtn.disabled) okBtn.click(); });

    footer.querySelector('.btn-cancel').addEventListener('click', () => { close(); resolve(null); });
    okBtn.addEventListener('click', async () => {
      if (okBtn.disabled) return;
      const name = isSave ? nameInput.value.trim() : selected.name;
      const path = joinPath(cwd, name);
      if (isSave) {
        const existing = await vfs.stat(path).catch(() => null);
        if (existing?.kind === 'dir') { await alert('Save As', `"${name}" is a folder.`); return; }
        if (existing && !(await confirm('Save As', `"${name}" already exists. Replace it?`, 'Replace'))) return;
      }
      close();
      resolve(path);
    });

    render();
  });
}
