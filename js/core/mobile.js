/* ============================================================
   Phone support.
   · Decides when the OS is in "mobile mode" (a phone-sized screen) and tags <html class="mobile">.
     In that mode every window is full-screen, with a bottom app bar instead of draggable windows.
   · Turns a long press into a right-click (iOS never sends one), so context menus work by touch.
   · Keeps the screen usable while the on-screen keyboard is open.
   Tablets and desktops keep the normal windowed layout.
   ============================================================ */

const QUERY = '(max-width: 720px), (pointer: coarse) and (max-height: 500px)';
const mq = window.matchMedia(QUERY);
const root = document.documentElement;
const listeners = new Set();

export const isMobile = () => mq.matches;
export function onMobileChange(cb) { listeners.add(cb); return () => listeners.delete(cb); }

function apply() {
  root.classList.toggle('mobile', mq.matches);
  for (const cb of listeners) { try { cb(mq.matches); } catch (e) { console.error(e); } }
}
if (mq.addEventListener) mq.addEventListener('change', apply); else mq.addListener(apply);
apply();

// The stylesheet travels with this file, so it works even if index.html wasn't updated.
try {
  if (!document.querySelector('link[href$="css/mobile.css"]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = new URL('../../css/mobile.css', import.meta.url).href;
    document.head.appendChild(l);
  }
} catch { /* cosmetic only */ }

// ---- Long press = right click (touch only) ----
const HOLD_MS = 550, SLOP = 10;
let hold = null;
let lastHold = 0;
const cancelHold = () => { if (hold) { clearTimeout(hold.timer); hold = null; } };

document.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch' || !e.isPrimary) return;
  cancelHold();
  const { clientX: x, clientY: y, target } = e;
  if (target.closest?.('input, textarea, select, [contenteditable="true"]')) return;      // let the OS handle text selection
  hold = {
    x, y,
    timer: setTimeout(() => {
      hold = null; lastHold = Date.now();
      target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window }));
    }, HOLD_MS)
  };
}, true);
document.addEventListener('pointermove', (e) => {
  if (hold && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > SLOP) cancelHold();
}, true);
document.addEventListener('pointerup', cancelHold, true);
document.addEventListener('pointercancel', cancelHold, true);
// Android sends its own contextmenu event at about the same time: don't double up.
document.addEventListener('contextmenu', (e) => { if (e.isTrusted) { cancelHold(); lastHold = Date.now(); } }, true);
// The finger lifting after a long press must not also count as a tap.
document.addEventListener('click', (e) => {
  if (Date.now() - lastHold < 700) { e.stopPropagation(); e.preventDefault(); }
}, true);

// ---- On-screen keyboard ----
// --kb is how much of the bottom of the screen the keyboard covers (0 when it is closed or
// the browser already resizes the page for it).
const vv = window.visualViewport;
if (vv) {
  const sync = () => {
    const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    root.style.setProperty('--kb', kb + 'px');
    root.classList.toggle('kb-open', kb > 120);
  };
  vv.addEventListener('resize', sync);
  vv.addEventListener('scroll', sync);
  sync();
  document.addEventListener('focusout', () => { setTimeout(() => { if (!root.classList.contains('kb-open')) window.scrollTo(0, 0); }, 50); });
}
