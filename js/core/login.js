import { esc } from './util.js';

let active = null; // the pending lock/login promise, so it can't be stacked twice

const pad = (n) => String(n).padStart(2, '0');

export function showLogin(isLockScreen = false) {
  if (active) return active;

  active = new Promise((resolve) => {
    let config = { name: 'User', password: '' };
    try { config = { ...config, ...(JSON.parse(localStorage.getItem('os16.config')) || {}) }; } catch {}
    const name = String(config.name || 'User');

    const overlay = document.createElement('div');
    overlay.className = 'fullscreen-overlay';
    overlay.id = 'lock-screen';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', isLockScreen ? 'Screen locked' : 'Log in');

    overlay.innerHTML = `
      <div class="lock-bg" aria-hidden="true"></div>
      <div class="lock-clock" aria-hidden="true">
        <div class="lock-time" id="lock-time">--:--</div>
        <div class="lock-date" id="lock-date"></div>
      </div>
      <form class="lock-box" id="lock-form" autocomplete="off">
        <div class="lock-avatar" aria-hidden="true"><span>${esc(name.charAt(0).toUpperCase() || '?')}</span></div>
        <div class="lock-name">${esc(name)}</div>
        <div class="lock-field" id="lock-field">
          <input type="password" class="lock-input" id="lock-pass" placeholder="Password"
                 aria-label="Password" aria-describedby="lock-err" autocomplete="off" spellcheck="false">
          <button type="submit" class="lock-btn" id="lock-btn" aria-label="${isLockScreen ? 'Unlock' : 'Log in'}">
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 8h9M8.5 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>
          </button>
        </div>
        <div class="lock-error" id="lock-err" role="alert"></div>
      </form>
      <div class="lock-foot">${isLockScreen ? 'Locked' : 'Monochrome OS'}</div>`;

    // Keep the desktop behind unreachable by keyboard / screen reader while this is up.
    const locked = [...document.body.children].filter((el) => el !== overlay && !el.hasAttribute('inert'));
    locked.forEach((el) => el.setAttribute('inert', ''));
    document.body.appendChild(overlay);

    const $ = (id) => overlay.querySelector(id);
    const inp = $('#lock-pass');
    const field = $('#lock-field');
    const err = $('#lock-err');
    const form = $('#lock-form');

    // Clock
    const tick = () => {
      const d = new Date();
      $('#lock-time').textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      $('#lock-date').textContent = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    };
    tick();
    const clockTimer = setInterval(tick, 1000);

    // Entrance: next frame so the transition runs
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('is-in')));
    setTimeout(() => inp.focus({ preventScroll: true }), 450);

    let busy = false;
    let errTimer = 0;

    const unlock = () => {
      busy = true;
      clearInterval(clockTimer);
      overlay.classList.add('is-out');
      const finish = () => {
        overlay.remove();
        locked.forEach((el) => el.removeAttribute('inert'));
        active = null;
        resolve();
      };
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTimeout(finish, reduce ? 0 : 520);
    };

    const fail = () => {
      err.textContent = 'Incorrect password';
      err.classList.add('show');
      field.classList.remove('shake');
      void field.offsetWidth; // restart the animation
      field.classList.add('shake');
      inp.value = '';
      inp.focus();
      clearTimeout(errTimer);
      errTimer = setTimeout(() => err.classList.remove('show'), 2200);
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (busy) return;
      inp.value === String(config.password ?? '') ? unlock() : fail();
    });
    inp.addEventListener('input', () => err.classList.remove('show'));
    // Don't let focus escape the overlay
    overlay.addEventListener('focusout', (e) => {
      if (!busy && !overlay.contains(e.relatedTarget)) setTimeout(() => inp.focus({ preventScroll: true }), 0);
    });
  });
  return active;
}
