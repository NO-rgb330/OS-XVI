import * as vfs from '../core/vfs.js';
import * as dialogs from '../core/dialogs.js';
import { iconHTML } from '../core/icons.js';
import { openWindow } from '../core/wm.js';

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  if (!bytes) return '';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const fileManagerApp = {
  id: 'files',
  name: 'Files',
  icon: 'folder',
  defaultSize: [820, 540],
  
  launch: async function(body, args, ctx) {
    let currentPath = args.path || '/home/user';
    let viewMode = 'list';
    let selectedNames = new Set();
    let currentItems = [];
    let contextMenu = null;

    body.innerHTML = `
      <div class="fm-app">
        <div class="app-toolbar fm-toolbar">
          <button class="toolbar-btn btn-up" title="Up"><svg class="icon"><use href="#i-up"/></svg></button>
          <button class="toolbar-btn btn-new" title="New Folder"><svg class="icon"><use href="#i-folder"/></svg><span style="font-size:14px;font-weight:bold;margin-left:-4px;margin-top:-2px;">+</span></button>
          <div class="toolbar-sep"></div>
          <button class="toolbar-btn btn-view" title="Toggle View"><svg class="icon"><use href="#i-list"/></svg></button>
        </div>
        
        <div class="fm-breadcrumbs"></div>
        
        <div class="fm-list-area">
          <div class="fm-list-header" style="display:none;">
            <div>Name</div>
            <div style="text-align:right;">Size</div>
            <div style="text-align:right;">Date Modified</div>
          </div>
          <div class="fm-list"></div>
        </div>
        
        <div class="app-statusbar">
          <div class="sb-cell grow sb-status">Ready</div>
          <div class="sb-cell sb-count"></div>
        </div>
      </div>
    `;

    const elCrumbs = body.querySelector('.fm-breadcrumbs');
    const elListArea = body.querySelector('.fm-list-area');
    const elHeader = body.querySelector('.fm-list-header');
    const elList = body.querySelector('.fm-list');
    const elStatus = body.querySelector('.sb-status');
    const elCount = body.querySelector('.sb-count');
    const btnUp = body.querySelector('.btn-up');
    const btnNew = body.querySelector('.btn-new');
    const btnView = body.querySelector('.btn-view');

    const renderBreadcrumbs = () => {
      elCrumbs.innerHTML = '';
      
      const rootBtn = document.createElement('span');
      rootBtn.className = 'fm-crumb' + (currentPath === '/' ? ' active' : '');
      rootBtn.textContent = 'Root';
      rootBtn.onclick = () => navigate('/');
      elCrumbs.appendChild(rootBtn);

      if (currentPath === '/') return;
      
      const parts = currentPath.split('/').filter(Boolean);
      let builtPath = '';
      
      parts.forEach((part, index) => {
        builtPath += '/' + part;
        const sep = document.createElement('span');
        sep.className = 'fm-crumb-sep';
        sep.textContent = '›';
        elCrumbs.appendChild(sep);

        const crumb = document.createElement('span');
        crumb.className = 'fm-crumb' + (index === parts.length - 1 ? ' active' : '');
        crumb.textContent = part;
        crumb.onclick = () => navigate(builtPath);
        elCrumbs.appendChild(crumb);
      });
    };

    const updateStatus = () => {
      elCount.textContent = `${currentItems.length} items`;
      if (selectedNames.size > 0) {
        elStatus.textContent = `${selectedNames.size} selected`;
      } else {
        elStatus.textContent = 'Ready';
      }
    };

    const render = () => {
      elList.innerHTML = '';
      
      if (viewMode === 'list') {
        elListArea.className = 'fm-list-area';
        elHeader.style.display = 'grid';
        elList.className = 'fm-list';
        btnView.innerHTML = `<svg class="icon"><use href="#i-grid"/></svg>`;
      } else {
        elListArea.className = 'fm-list-area fm-grid';
        elHeader.style.display = 'none';
        elList.className = 'fm-grid';
        btnView.innerHTML = `<svg class="icon"><use href="#i-list"/></svg>`;
      }

      if (currentItems.length === 0) {
        elList.innerHTML = `
          <div class="app-empty" style="grid-column: 1/-1; padding: 40px;">
            <svg class="icon"><use href="#i-folder"/></svg>
            <div>Folder is empty</div>
          </div>`;
        updateStatus();
        return;
      }

      currentItems.forEach(item => {
        const isSel = selectedNames.has(item.name);
        const iconType = item.kind === 'dir' ? 'folder' : 'file';
        
        if (viewMode === 'list') {
          const row = document.createElement('div');
          row.className = 'app-list-row' + (isSel ? ' selected' : '');
          row.innerHTML = `
            <div class="row-name">${iconHTML(iconType, 18)} <span>${item.name}</span></div>
            <div class="row-meta">${item.kind === 'dir' ? 'Folder' : formatBytes(item.size)}</div>
            <div class="row-meta">${formatDate(item.mtime)}</div>
          `;
          
          row.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!e.ctrlKey && !e.metaKey) selectedNames.clear();
            if (selectedNames.has(item.name) && (e.ctrlKey || e.metaKey)) selectedNames.delete(item.name);
            else selectedNames.add(item.name);
            render();
          });
          
          row.addEventListener('dblclick', () => handleOpen(item));
          row.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!selectedNames.has(item.name)) {
              selectedNames.clear();
              selectedNames.add(item.name);
              render();
            }
            showContextMenu(e.clientX, e.clientY);
          });

          elList.appendChild(row);
        } else {
          const gridItem = document.createElement('div');
          gridItem.className = 'fm-grid-item' + (isSel ? ' selected' : '');
          gridItem.innerHTML = `
            ${iconHTML(iconType, 48)}
            <div class="fm-grid-label">${item.name}</div>
          `;
          
          gridItem.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!e.ctrlKey && !e.metaKey) selectedNames.clear();
            if (selectedNames.has(item.name) && (e.ctrlKey || e.metaKey)) selectedNames.delete(item.name);
            else selectedNames.add(item.name);
            render();
          });
          
          gridItem.addEventListener('dblclick', () => handleOpen(item));
          gridItem.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!selectedNames.has(item.name)) {
              selectedNames.clear();
              selectedNames.add(item.name);
              render();
            }
            showContextMenu(e.clientX, e.clientY);
          });

          elList.appendChild(gridItem);
        }
      });
      
      updateStatus();
    };

    const navigate = async (path) => {
      try {
        const items = await vfs.list(path);
        currentPath = path;
        currentItems = items;
        selectedNames.clear();
        renderBreadcrumbs();
        render();
        ctx.setTitle(`Files — ${path}`);
      } catch (err) {
        dialogs.alert('Error', 'Cannot open folder: ' + err.message);
      }
    };

    const handleOpen = (item) => {
      if (item.kind === 'dir') {
        navigate(currentPath === '/' ? '/' + item.name : currentPath + '/' + item.name);
      } else {
        const fullPath = currentPath === '/' ? '/' + item.name : currentPath + '/' + item.name;
        const ext = item.name.split('.').pop().toLowerCase();
        
        // Route to Notepad for text files
        if (['txt', 'md', 'js', 'json', 'css', 'html', 'log'].includes(ext)) {
          openWindow('notepad', { path: fullPath });
        } else {
          dialogs.alert('Open File', `Would open "${item.name}" with the default app. (App not built yet)`);
        }
      }
    };

    btnUp.onclick = () => {
      if (currentPath === '/') return;
      navigate(currentPath.substring(0, currentPath.lastIndexOf('/')) || '/');
    };

    btnNew.onclick = async () => {
      const name = await dialogs.prompt('New Folder', 'Enter folder name:');
      if (!name) return;
      const newPath = currentPath === '/' ? '/' + name : currentPath + '/' + name;
      try {
        await vfs.mkdir(newPath);
        navigate(currentPath);
      } catch (err) {
        dialogs.alert('Error', 'Could not create folder: ' + err.message);
      }
    };

    btnView.onclick = () => {
      viewMode = viewMode === 'list' ? 'grid' : 'list';
      render();
    };

    elListArea.addEventListener('mousedown', (e) => {
      if (e.target === elListArea || e.target === elList) {
        selectedNames.clear();
        render();
      }
    });

    const unsub = vfs.on('change', (path) => {
      if (path === currentPath) {
        navigate(currentPath);
      }
    });

    const showContextMenu = (x, y) => {
      if (contextMenu) contextMenu.remove();
      contextMenu = document.createElement('div');
      contextMenu.className = 'fm-ctx-menu';
      
      const items = [
        { label: 'Open', action: () => {
          const name = Array.from(selectedNames)[0];
          const item = currentItems.find(i => i.name === name);
          if (item) handleOpen(item);
        }, disabled: selectedNames.size !== 1 },
        { label: 'Rename', action: async () => {
          const oldName = Array.from(selectedNames)[0];
          const newName = await dialogs.prompt('Rename', 'Enter new name:', oldName);
          if (newName && newName !== oldName) {
            const oldPath = currentPath === '/' ? '/' + oldName : currentPath + '/' + oldName;
            const newPath = currentPath === '/' ? '/' + newName : currentPath + '/' + newName;
            await vfs.mv(oldPath, newPath);
          }
        }, disabled: selectedNames.size !== 1 },
        { type: 'sep' },
        { label: 'Delete', action: async () => {
          if (await dialogs.confirm('Delete', `Delete ${selectedNames.size} item(s)?`)) {
            for (const name of selectedNames) {
              await vfs.rm(currentPath === '/' ? '/' + name : currentPath + '/' + name);
            }
          }
        }, danger: true }
      ];
      
      items.forEach(item => {
        if (item.type === 'sep') {
          const sep = document.createElement('div');
          sep.className = 'fm-ctx-sep';
          contextMenu.appendChild(sep);
          return;
        }
        const btn = document.createElement('div');
        btn.className = 'fm-ctx-item' + (item.danger ? ' danger' : '');
        if (item.disabled) {
          btn.style.opacity = '0.4';
          btn.style.pointerEvents = 'none';
        } else {
          btn.onclick = () => {
            contextMenu.remove();
            contextMenu = null;
            item.action();
          };
        }
        btn.textContent = item.label;
        contextMenu.appendChild(btn);
      });

      document.body.appendChild(contextMenu);
      
      const rect = contextMenu.getBoundingClientRect();
      if (x + rect.width > window.innerWidth) x -= rect.width;
      if (y + rect.height > window.innerHeight) y -= rect.height;
      
      contextMenu.style.left = x + 'px';
      contextMenu.style.top = y + 'px';
    };

    const closeContextMenu = (e) => {
      if (contextMenu && !contextMenu.contains(e.target)) {
        contextMenu.remove();
        contextMenu = null;
      }
    };
    document.addEventListener('pointerdown', closeContextMenu);

    ctx.onCleanup(() => {
      unsub();
      document.removeEventListener('pointerdown', closeContextMenu);
      if (contextMenu) contextMenu.remove();
    });

    navigate(currentPath);
  }
};
