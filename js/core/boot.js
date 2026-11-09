/* ============================================================
   Boot orchestrator — runs the pre-login checks with timeouts,
   reports to a live overlay, and either proceeds to login or
   halts with a reload prompt.

   Per-stage timeouts produce SYSTEM HANG (code 2); thrown errors
   or missing DOM elements produce FAILURE (code 1); a nearly-full
   disk produces a warning (code 3) that the user can bypass.

   Python WASM is kicked off in the background — its success is
   reported but does not gate boot.
   ============================================================ */

import { BootCode, codeLabel, mkResult, overallCode } from './boot-codes.js';
import {
  checkDom, checkStorage, checkVfsMount, checkDisk,
  checkSeed, checkApps, checkShell
} from './boot-check.js';
import { initPython } from './python-runtime.js';

const STAGE_TIMEOUTS = {
  dom: 2000,
  storage: 2000,
  vfs: 15000,
  disk: 15000,
  seed: 30000,
  apps: 2000,
  shell: 10000
};

const STAGE_LABELS = {
  dom: 'DOM shell',
  storage: 'Web Storage + IndexedDB',
  vfs: 'Virtual file system',
  disk: 'Virtual disk',
  seed: 'System files',
  apps: 'App registry',
  shell: 'Desktop shell'
};

/** Race a promise against a wall-clock timeout, throwing a synthetic HANG marker on expiry. */
function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject({ __hang: true, ms }), ms);
  });
  return Promise.race([Promise.resolve(promise), timeout])
    .finally(() => clearTimeout(timer));
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatMs(ms) {
  if (!ms || ms < 1) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export async function runBootSequence({ vfs, seed, apps, register, initPanel, initDesktop }) {
  const overlay = document.createElement('div');
  overlay.className = 'fullscreen-overlay';
  overlay.id = 'boot-screen';
  overlay.innerHTML = `
    <div class="boot-panel">
      <div class="boot-brand">
        <svg class="icon boot-brand-icon" aria-hidden="true"><use href="#i-desktop"/></svg>
        <div class="boot-brand-text">
          <div class="boot-brand-title">OS-XVI</div>
          <div class="boot-brand-sub">System check</div>
        </div>
      </div>
      <div class="boot-stages" id="boot-stages" role="log" aria-live="polite"></div>
      <div class="boot-progress" aria-hidden="true"><div class="boot-progress-fill" id="boot-progress-fill"></div></div>
      <div class="boot-summary" id="boot-summary" hidden></div>
      <div class="boot-actions" id="boot-actions" hidden></div>
    </div>`;
  document.body.appendChild(overlay);

  const elStages = overlay.querySelector('#boot-stages');
  const elProgress = overlay.querySelector('#boot-progress-fill');
  const elSummary = overlay.querySelector('#boot-summary');
  const elActions = overlay.querySelector('#boot-actions');

  // Background Python load — status shows up as a note but does not gate boot.
  const pythonNote = document.createElement('div');
  let pythonState = 'loading';
  initPython()
    .then(() => {
      pythonState = 'ok';
      pythonNote.className = 'boot-stage boot-stage-note';
      pythonNote.innerHTML = `
        <span class="boot-stage-badge">OK</span>
        <span class="boot-stage-label">Python runtime (background)</span>
        <span class="boot-stage-msg">loaded</span>
        <span class="boot-stage-time"></span>`;
    })
    .catch((err) => {
      pythonState = 'failed';
      pythonNote.className = 'boot-stage boot-stage-note';
      pythonNote.innerHTML = `
        <span class="boot-stage-badge boot-stage-badge-warn">—</span>
        <span class="boot-stage-label">Python runtime (background)</span>
        <span class="boot-stage-msg">${escapeHtml(String(err?.message || err).slice(0, 120))}</span>
        <span class="boot-stage-time"></span>`;
    });

  function pushStage(result) {
    const el = document.createElement('div');
    el.className = 'boot-stage';
    const badge = result.code === BootCode.OK
      ? 'boot-stage-badge'
      : result.code === BootCode.DISK_FULL
        ? 'boot-stage-badge boot-stage-badge-warn'
        : 'boot-stage-badge boot-stage-badge-fail';
    const badgeText = result.code === BootCode.OK ? 'OK' : codeLabel(result.code);
    el.innerHTML = `
      <span class="${badge}">${badgeText}</span>
      <span class="boot-stage-label">${escapeHtml(result.label)}</span>
      <span class="boot-stage-msg">${escapeHtml(result.message)}</span>
      <span class="boot-stage-time">${formatMs(result.ms)}</span>`;
    elStages.appendChild(el);
    elStages.scrollTop = elStages.scrollHeight;
  }

  const stages = [
    { key: 'dom',     run: () => checkDom() },
    { key: 'storage', run: () => checkStorage() },
    { key: 'vfs',     run: () => checkVfsMount(vfs) },
    { key: 'disk',    run: () => checkDisk(vfs) },
    { key: 'seed',    run: () => checkSeed(seed) },
    { key: 'apps',    run: () => checkApps(apps) },
    {
      key: 'shell',
      run: () => checkShell(async () => {
        for (const app of apps) register(app);
        initPanel();
        await initDesktop();
      })
    }
  ];

  const results = [];

  for (let i = 0; i < stages.length; i++) {
    const { key, run } = stages[i];
    const label = STAGE_LABELS[key];
    elProgress.style.width = `${(i / stages.length) * 100}%`;

    const t0 = performance.now();
    let result;
    try {
      result = await withTimeout(run(), STAGE_TIMEOUTS[key]);
      if (!result || typeof result !== 'object' || !('code' in result)) {
        result = mkResult(key, label, BootCode.FAILURE,
          'Stage returned no result', performance.now() - t0);
      }
    } catch (e) {
      if (e && e.__hang) {
        result = mkResult(key, label, BootCode.HANG,
          `Stage did not complete within ${e.ms}ms`, performance.now() - t0);
      } else {
        result = mkResult(key, label, BootCode.FAILURE,
          String(e?.message || e), performance.now() - t0);
      }
    }
    pushStage(result);
    results.push(result);

    // FAILURE or HANG: halt. The shell (register/initPanel/initDesktop) is
    // not idempotent, so continuing past a broken stage would be worse than
    // reporting the problem and letting the user reload.
    if (result.code === BootCode.FAILURE || result.code === BootCode.HANG) break;
  }

  elProgress.style.width = '100%';
  await new Promise((r) => setTimeout(r, 120));    // let the bar visibly reach 100%

  const overall = overallCode(results);

  if (overall === BootCode.OK) {
    if (pythonState !== 'ok') elStages.appendChild(pythonNote);
    elSummary.hidden = false;
    elSummary.textContent = 'Boot complete.';
    await new Promise((r) => setTimeout(r, 260));
    overlay.remove();
    return { code: overall, results };
  }

  if (overall === BootCode.DISK_FULL) {
    if (pythonState !== 'ok') elStages.appendChild(pythonNote);
    elSummary.hidden = false;
    elSummary.textContent = 'Boot finished with a warning. The virtual disk is nearly full — you can still log in and free up space.';
    return new Promise((resolve) => {
      elActions.hidden = false;
      elActions.innerHTML = `
        <button type="button" class="app-btn primary" data-act="continue">Continue anyway</button>
        <button type="button" class="app-btn" data-act="reload">Reload page</button>`;
      elActions.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        if (b.dataset.act === 'continue') {
          overlay.remove();
          resolve({ code: overall, results });
        } else if (b.dataset.act === 'reload') {
          location.reload();
        }
      });
    });
  }

  // FAILURE or HANG — the promise never resolves; the reload button is the only way out.
  elSummary.hidden = false;
  elSummary.textContent = overall === BootCode.HANG
    ? 'Boot halted: a stage did not respond in time.'
    : 'Boot halted: a required system check failed.';

  const failing = results.find((r) => r.code === BootCode.FAILURE || r.code === BootCode.HANG) || results.at(-1);
  elActions.hidden = false;
  elActions.innerHTML = `
    <div class="boot-error-detail" role="alert">
      <div class="boot-error-head">
        <strong>${escapeHtml(failing?.label || 'Boot stage')}</strong>
        <span class="boot-stage-badge boot-stage-badge-fail">${codeLabel(overall)}</span>
      </div>
      <div class="boot-error-body">${escapeHtml(failing?.message || 'Unknown error')}</div>
    </div>
    <div class="boot-error-actions">
      <button type="button" class="app-btn primary" data-act="reload">Reload page</button>
    </div>`;
  elActions.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b?.dataset.act === 'reload') location.reload();
  });
  return new Promise(() => { /* never resolves */ });
}
