// Taskbar battery indicator. Uses the Battery Status API (Chromium-based browsers only);
// where unsupported (Firefox/Safari) or the device has no battery, nothing is shown.
export async function initBattery() {
  const host = document.getElementById('panel-right');
  if (!host || typeof navigator.getBattery !== 'function') return;
  let bat;
  try { bat = await navigator.getBattery(); } catch { return; }

  const el = document.createElement('div');
  el.id = 'battery';
  el.className = 'panel-battery';
  el.innerHTML = `<svg class="batt-icon" viewBox="0 0 26 12" aria-hidden="true">
      <rect x=".5" y=".5" width="22" height="11" fill="none" stroke="currentColor"/>
      <rect x="23" y="3.5" width="2.5" height="5" fill="currentColor"/>
      <rect class="batt-fill" x="2" y="2" width="0" height="8" fill="currentColor"/>
      <path class="batt-bolt" d="M12.5 2 8 6.5h3L10 10l4.5-4.5h-3z" />
    </svg><span class="batt-pct"></span>`;
  host.insertBefore(el, host.firstChild);
  const fill = el.querySelector('.batt-fill');
  const pctEl = el.querySelector('.batt-pct');

  function render() {
    const pct = Math.round(bat.level * 100);
    fill.setAttribute('width', String(Math.max(0, Math.min(19, (19 * pct) / 100)).toFixed(1)));
    pctEl.textContent = `${pct}%`;
    el.classList.toggle('charging', bat.charging);
    el.classList.toggle('low', pct <= 20 && !bat.charging);
    let t = `Battery ${pct}%${bat.charging ? ' (charging)' : ''}`;
    const secs = bat.charging ? bat.chargingTime : bat.dischargingTime;
    if (Number.isFinite(secs) && secs > 0) {
      t += `, ${Math.floor(secs / 3600)}h ${Math.round((secs % 3600) / 60)}m ${bat.charging ? 'to full' : 'left'}`;
    }
    el.title = t;
    el.setAttribute('aria-label', t);
  }
  ['levelchange', 'chargingchange', 'chargingtimechange', 'dischargingtimechange'].forEach((ev) => bat.addEventListener(ev, render));
  render();
}
