/* Single shared context menu (uses the #context-menu node in index.html). */

let menu = null;
let installed = false;

export function hideMenu() {
  if (menu) menu.hidden = true;
}

function install() {
  if (installed) return;
  installed = true;
  document.addEventListener('pointerdown', (e) => {
    if (menu && !menu.hidden && !menu.contains(e.target)) hideMenu();
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideMenu(); }, true);
  window.addEventListener('blur', hideMenu);
  window.addEventListener('resize', hideMenu);
}

/**
 * items: [{ label, action, disabled, danger, hint }, { sep: true }]
 */
export function showMenu(x, y, items) {
  menu ??= document.getElementById('context-menu');
  install();

  menu.replaceChildren(...items.map((it) => {
    const el = document.createElement('div');
    if (it.sep) { el.className = 'context-sep'; return el; }
    el.className = 'context-item' + (it.danger ? ' danger' : '');
    el.setAttribute('role', 'menuitem');
    if (it.disabled) el.setAttribute('aria-disabled', 'true');
    const label = document.createElement('span');
    label.textContent = it.label;
    el.appendChild(label);
    if (it.hint) {
      const hint = document.createElement('span');
      hint.className = 'context-hint';
      hint.textContent = it.hint;
      el.appendChild(hint);
    }
    el.addEventListener('click', () => { hideMenu(); it.action?.(); });
    return el;
  }));

  menu.hidden = false;
  const { width, height } = menu.getBoundingClientRect();
  menu.style.left = Math.max(0, Math.min(x, window.innerWidth - width - 2)) + 'px';
  menu.style.top = Math.max(0, Math.min(y, window.innerHeight - height - 2)) + 'px';
}
