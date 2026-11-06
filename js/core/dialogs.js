import * as vfs from './vfs.js';
import { iconHTML } from './icons.js';

const layer = document.getElementById('dialog-layer');
let activeDialogs = 0;

function createModal(title, contentHTML, buttonsHTML) {
  const backdrop = document.createElement('div');
  backdrop.className = 'dialog-backdrop';
  
  const box = document.createElement('div');
  box.className = 'window focused dialog-box';
  box.style.position = 'relative';
  box.style.width = '420px';
  box.style.height = 'auto';
  box.style.maxWidth = '100%';
  box.style.maxHeight = '100%';
  box.style.display = 'flex';
  box.style.flexDirection = 'column';

  box.innerHTML = `
    <div class="window-titlebar" style="cursor:default;">
      <div class="window-title">${title}</div>
      <div class="window-buttons">
        <button class="window-btn window-btn-close" title="Close">
          <svg class="icon" aria-hidden="true"><use href="#i-close"/></svg>
        </button>
      </div>
    </div>
    <div class="window-body dialog-content" style="padding:0;">
      ${contentHTML}
    </div>
    <div class="dialog-footer" style="display:flex; gap:8px; justify-content:flex-end; padding:12px; background:var(--surface); border-top:1px solid var(--bd-soft);">
      ${buttonsHTML}
    </div>
  `;

  backdrop.appendChild(box);
  layer.appendChild(backdrop);
  
  if (activeDialogs === 0) layer.hidden = false;
  activeDialogs++;

  const onKeyDown = (e) => {
    if (e.key === 'Escape' && layer.lastElementChild === backdrop) {
      e.stopPropagation();
      const cancelBtn = box.querySelector('.btn-cancel');
      if (cancelBtn) cancelBtn.click();
      else close();
    }
  };

  document.addEventListener('keydown', onKeyDown);

  const close = () => {
    document.removeEventListener('keydown', onKeyDown);
    backdrop.remove();
    activeDialogs--;
    if (activeDialogs === 0) layer.hidden = true;
  };

  box.querySelector('.window-btn-close').addEventListener('click', () => {
    const cancelBtn = box.querySelector('.btn-cancel');
    if (cancelBtn) cancelBtn.click();
    else close();
  });

  return { backdrop, box, close, content: box.querySelector('.dialog-content'), footer: box.querySelector('.dialog-footer') };
}

// ---- Standard Dialogs ----

export function alert(title, message) {
  return new Promise((resolve) => {
    const { close, footer } = createModal(title, `<div class="app-form"><p style="margin:0;">${message}</p></div>`, `
      <button class="app-btn primary btn-ok">OK</button>
    `);
    footer.querySelector('.btn-ok').addEventListener('click', () => { close(); resolve(); });
    footer.querySelector('.btn-ok').focus();
  });
}

export function confirm(title, message) {
  return new Promise((resolve) => {
    const { close, footer } = createModal(title, `<div class="app-form"><p style="margin:0;">${message}</p></div>`, `
      <button class="app-btn btn-cancel">Cancel</button>
      <button class="app-btn primary btn-ok">OK</button>
    `);
    footer.querySelector('.btn-cancel').addEventListener('click', () => { close(); resolve(false); });
    footer.querySelector('.btn-ok').addEventListener('click', () => { close(); resolve(true); });
    footer.querySelector('.btn-ok').focus();
  });
}

export function prompt(title, message, defaultValue = '') {
  return new Promise((resolve) => {
    const { close, footer, content } = createModal(title, `
      <div class="app-form">
        <p style="margin:0 0 10px 0;">${message}</p>
        <input class="app-input" type="text" value="${defaultValue.replace(/"/g, '&quot;')}">
      </div>
    `, `
      <button class="app-btn btn-cancel">Cancel</button>
      <button class="app-btn primary btn-ok">OK</button>
    `);
    
    const input = content.querySelector('input');
    setTimeout(() => { input.focus(); input.select(); }, 50);
    
    const doOk = () => { close(); resolve(input.value); };
    
    footer.querySelector('.btn-cancel').addEventListener('click', () => { close(); resolve(null); });
    footer.querySelector('.btn-ok').addEventListener('click', doOk);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); doOk(); }
    });
  });
}

// ---- File Picker ----

export async function filePicker(title, mode = 'open', defaultPath = '/home/user', defaultFilename = '') {
  return new Promise(async (resolve) => {
    let currentPath = defaultPath;
    let selectedName = null;
    let selectedKind = null;

    const contentHTML = `
      <div style="display:flex; flex-direction:column; height:340px; width:500px;">
        <div style="display:flex; align-items:center; gap:4px; padding:8px; border-bottom:1px solid var(--bd-soft); background:var(--surface);">
          <button class="toolbar-btn btn-up" title="Up" style="padding:2px 6px; height:22px;">
            <svg class="icon"><use href="#i-up"/></svg>
          </button>
          <button class="toolbar-btn btn-newdir" title="New Folder" style="padding:2px 6px; height:22px;">
            <svg class="icon"><use href="#i-folder"/></svg><span style="font-size:14px; font-weight:bold; margin-left:-2px;">+</span>
          </button>
          <div class="path-display" style="font-size:12px; font-family:var(--font-mono); background:var(--bg-input); padding:2px 6px; border:1px solid var(--bd-inset); flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"></div>
        </div>
        <div class="picker-list app-list" style="flex:1; overflow:auto; padding:4px;"></div>
        ${mode === 'save' ? `
        <div style="padding:8px; border-top:1px solid var(--bd-soft); display:flex; align-items:center; gap:8px; background:var(--surface);">
          <label style="font-size:12px; font-weight:600;">File name:</label>
          <input class="app-input picker-filename" type="text" value="${defaultFilename.replace(/"/g, '&quot;')}" style="flex:1; margin:0;">
        </div>
        ` : ''}
      </div>
    `;

    const { close, footer, content } = createModal(title, contentHTML, `
      <button class="app-btn btn-cancel">Cancel</button>
      <button class="app-btn primary btn-ok" disabled>${mode === 'save' ? 'Save' : 'Open'}</button>
    `);

    const listEl = content.querySelector('.picker-list');
    const pathEl = content.querySelector('.path-display');
    const upBtn = content.querySelector('.btn-up');
    const newDirBtn = content.querySelector('.btn-newdir');
    const okBtn = footer.querySelector('.btn-ok');
    const filenameInput = content.querySelector('.picker-filename');

    const updateOkState = () => {
      if (mode === 'save') {
        okBtn.disabled = !filenameInput.value.trim();
      } else {
        okBtn.disabled = !selectedName || selectedKind === 'dir';
      }
    };

    if (filenameInput) {
      filenameInput.addEventListener('input', updateOkState);
      filenameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !okBtn.disabled) okBtn.click();
      });
    }

    const renderDir = async () => {
      pathEl.textContent = currentPath;
      pathEl.title = currentPath;
      listEl.innerHTML = '<div style="padding:10px; text-align:center; color:var(--tx-muted);">Loading...</div>';
      
      try {
        const items = await vfs.list(currentPath);
        listEl.innerHTML = '';
        
        for (const item of items) {
          const row = document.createElement('div');
          row.className = 'app-list-row';
          if (selectedName === item.name) row.classList.add('selected');
          
          const icon = item.kind === 'dir' ? 'folder' : 'file';
          row.innerHTML = `
            <div class="row-name">${iconHTML(icon)} <span>${item.name}</span></div>
            <div class="row-meta">${item.kind === 'dir' ? '' : (item.size ? item.size + ' B' : '')}</div>
          `;
          
          row.addEventListener('click', (e) => {
            e.stopPropagation();
            listEl.querySelectorAll('.app-list-row').forEach(r => r.classList.remove('selected'));
            row.classList.add('selected');
            selectedName = item.name;
            selectedKind = item.kind;
            if (filenameInput && item.kind === 'file') filenameInput.value = item.name;
            updateOkState();
          });
          
          row.addEventListener('dblclick', () => {
            if (item.kind === 'dir') {
              currentPath = currentPath === '/' ? '/' + item.name : currentPath + '/' + item.name;
              selectedName = null;
              selectedKind = null;
              if (filenameInput && mode === 'save') filenameInput.value = '';
              renderDir();
            } else if (mode === 'open') {
              okBtn.click();
            }
          });
          
          listEl.appendChild(row);
        }
      } catch (err) {
        listEl.innerHTML = `<div style="padding:10px; color:var(--tx); font-weight:600;">Error: ${err.message}</div>`;
      }
    };

    upBtn.addEventListener('click', () => {
      if (currentPath === '/') return;
      currentPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
      selectedName = null;
      selectedKind = null;
      if (filenameInput && mode === 'save') filenameInput.value = '';
      renderDir();
    });

    newDirBtn.addEventListener('click', async () => {
      const name = await prompt('New Folder', 'Enter folder name:');
      if (!name) return;
      const newPath = currentPath === '/' ? '/' + name : currentPath + '/' + name;
      try {
        await vfs.mkdir(newPath);
        await renderDir();
        // Select the new folder
        const rows = listEl.querySelectorAll('.app-list-row');
        for (const r of rows) {
          if (r.querySelector('span').textContent === name) {
            r.click();
            break;
          }
        }
      } catch (err) {
        alert('Error', 'Could not create folder: ' + err.message);
      }
    });

    footer.querySelector('.btn-cancel').addEventListener('click', () => { close(); resolve(null); });
    
    okBtn.addEventListener('click', () => {
      if (mode === 'save') {
        const name = filenameInput.value.trim();
        if (!name) return;
        const fullPath = currentPath === '/' ? '/' + name : currentPath + '/' + name;
        close();
        resolve(fullPath);
      } else {
        if (!selectedName || selectedKind === 'dir') return;
        const fullPath = currentPath === '/' ? '/' + selectedName : currentPath + '/' + selectedName;
        close();
        resolve(fullPath);
      }
    });

    await renderDir();
  });
}
