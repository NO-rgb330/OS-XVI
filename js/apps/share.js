/* ============================================================
   Quick Share — send files straight to another computer.
   Pair with a 6-digit code (or by copy/paste), then drag files in.
   The transfer itself is browser-to-browser; see core/share-rtc.js.
   ============================================================ */

import * as dialogs from '../core/dialogs.js';
import { iconHTML } from '../core/icons.js';
import { esc, formatBytes } from '../core/util.js';
import { hasFiles, filesFromDrop } from '../core/dnd.js';
import { pickFiles } from '../core/upload.js';
import * as rtc from '../core/share-rtc.js';

const ROUTE_TEXT = {
  'direct-local': 'Direct connection on your local network',
  'direct-internet': 'Direct connection over the internet',
  relay: 'Connected through a relay (slower)',
  unknown: 'Connected'
};

const fmtSpeed = (bps) => (bps > 0 ? formatBytes(bps) + '/s' : '');
function fmtEta(sec) {
  if (!isFinite(sec) || sec < 0) return '';
  if (sec < 60) return Math.max(1, Math.round(sec)) + ' s left';
  if (sec < 3600) return Math.round(sec / 60) + ' min left';
  return (sec / 3600).toFixed(1) + ' h left';
}
const spaced = (code) => code.slice(0, 3) + ' ' + code.slice(3);

export const shareApp = {
  id: 'share',
  name: 'Quick Share',
  icon: 'share',
  defaultSize: [620, 560],
  singleton: true,

  launch(body, args, ctx) {
    let view = 'home';              // home | hosting | request | joining | check | manual-guest | manual-host | connected
    let note = '';                  // error / hint line on the current screen
    let handle = null;              // cancel() of an active pairing
    let session = null;
    let data = {};                  // per-view data (code, sas, texts…)
    let tick = null, wakeLock = null;
    const rows = new Map();         // transfer id -> row element
    const samples = new Map();      // transfer id -> [{t, b}]
    let dead = false;

    body.innerHTML = '<div class="share-app"></div>';
    const root = body.querySelector('.share-app');

    // ------------------------------------------------------------ screens
    const shell = (inner) => `<div class="share-screen">${inner}${note ? `<p class="share-note">${esc(note)}</p>` : ''}</div>`;

    function show() {
      if (dead) return;
      if (view === 'connected') return showConnected();
      let h = '';
      if (view === 'home') {
        h = shell(`
          <div class="share-hero">${iconHTML('share', 40)}<h2>Quick Share</h2>
          <p>Send files straight to another computer, as fast as your network allows. Nothing is uploaded to a server.</p></div>
          <div class="share-actions">
            <button class="app-btn primary share-big" data-act="host">Show my code</button>
            <button class="app-btn share-big" data-act="join">Enter a code</button>
          </div>
          <p class="share-small">Both computers need to be on the same network. Some school and public Wi-Fi blocks devices from talking to each other.</p>
          <button class="share-link" data-act="manual">Pair manually instead (no internet service)</button>`);
      } else if (view === 'hosting') {
        h = shell(`
          <div class="share-hero"><p>On the other computer, open Quick Share, choose <b>Enter a code</b>, and type:</p>
          <div class="share-code" aria-live="polite">${data.code ? esc(spaced(data.code)) : '… … …'}</div>
          <p class="share-wait">Waiting for the other device…</p></div>
          <div class="share-actions"><button class="app-btn" data-act="cancel">Cancel</button></div>`);
      } else if (view === 'request') {
        h = shell(`
          <div class="share-hero"><p><b>${esc(data.name)}</b> wants to connect.</p>
          <p>Check that the other screen shows this number:</p>
          <div class="share-code">${esc(data.sas)}</div></div>
          <div class="share-actions">
            <button class="app-btn primary" data-act="accept">Numbers match — connect</button>
            <button class="app-btn" data-act="reject">Decline</button>
          </div>`);
      } else if (view === 'joining') {
        h = shell(`
          <div class="share-hero"><p>Type the 6-digit code shown on the other computer:</p>
          <input class="app-input share-code-input" inputmode="numeric" maxlength="7" autocomplete="off" placeholder="000 000" value="${esc(data.typed || '')}">
          </div>
          <div class="share-actions">
            <button class="app-btn primary" data-act="go" ${data.busy ? 'disabled' : ''}>${data.busy ? 'Connecting…' : 'Connect'}</button>
            <button class="app-btn" data-act="cancel">Cancel</button>
          </div>`);
      } else if (view === 'check') {
        h = shell(`
          <div class="share-hero"><p>Check that the other screen shows this number:</p>
          <div class="share-code">${esc(data.sas)}</div>
          <p class="share-wait">${data.confirmed ? 'Connecting…' : ''}</p></div>
          <div class="share-actions">
            <button class="app-btn primary" data-act="match" ${data.confirmed ? 'disabled' : ''}>Numbers match</button>
            <button class="app-btn" data-act="cancel">They don’t match</button>
          </div>`);
      } else if (view === 'manual') {
        h = shell(`
          <div class="share-hero"><p><b>Manual pairing.</b> Copy a text to the other computer by any means (chat, email, a note) and paste the reply back.</p></div>
          <div class="share-actions">
            <button class="app-btn" data-act="m-start">I’m starting: create my text</button>
            <button class="app-btn" data-act="m-paste">I received a text</button>
          </div>
          <div class="share-actions"><button class="app-btn" data-act="cancel">Back</button></div>`);
      } else if (view === 'manual-guest') {
        h = shell(`
          <div class="share-step"><b>1.</b> Copy this text to the other computer and paste it into <i>I received a text</i>.</div>
          <textarea class="app-textarea share-text" readonly>${esc(data.text || 'Creating…')}</textarea>
          <button class="app-btn" data-act="copy">Copy text</button>
          <div class="share-step"><b>2.</b> Paste the reply you get back:</div>
          <textarea class="app-textarea share-text share-reply" placeholder="Paste the reply here"></textarea>
          <div class="share-actions"><button class="app-btn primary" data-act="m-finish" ${data.busy ? 'disabled' : ''}>Connect</button><button class="app-btn" data-act="cancel">Cancel</button></div>`);
      } else if (view === 'manual-host') {
        h = shell(data.text ? `
          <div class="share-step"><b>2.</b> Copy this reply back to the other computer. Check that it shows <b>${esc(data.sas)}</b>.</div>
          <textarea class="app-textarea share-text" readonly>${esc(data.text)}</textarea>
          <button class="app-btn" data-act="copy">Copy reply</button>
          <p class="share-wait">${data.connecting ? 'Waiting for the other device to connect…' : ''}</p>
          <div class="share-actions"><button class="app-btn" data-act="cancel">Cancel</button></div>` : `
          <div class="share-step"><b>1.</b> Paste the text from the other computer:</div>
          <textarea class="app-textarea share-text share-reply" placeholder="Paste the text here"></textarea>
          <div class="share-actions"><button class="app-btn primary" data-act="m-answer" ${data.busy ? 'disabled' : ''}>Create reply</button><button class="app-btn" data-act="cancel">Cancel</button></div>`);
      }
      root.innerHTML = h;
      const input = root.querySelector('.share-code-input');
      if (input) {
        input.focus();
        input.addEventListener('input', () => {
          const d = input.value.replace(/\D/g, '').slice(0, 6);
          input.value = d.length > 3 ? d.slice(0, 3) + ' ' + d.slice(3) : d;
          data.typed = input.value;
        });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') act('go'); });
      }
    }

    const reset = (msg = '') => {
      try { handle?.cancel?.(); } catch { /* ignore */ }
      handle = null; data = {}; view = 'home'; note = msg; show();
    };
    const fail = (msg) => { if (!session) { try { handle?.cancel?.(); } catch { /* ignore */ } handle = null; data = {}; view = 'home'; note = msg; show(); } };

    function adopt(s, alreadyConfirmed) {
      session = s;
      s.on('transfer', (t) => { if (view === 'connected') { if (t.state === 'active') sample(t); upsert(t); } });
      s.on('closed', (reason) => { endSession(reason); });
      s.on('ready', () => { view = 'connected'; note = ''; show(); });
      if (alreadyConfirmed) s.confirm();
      else if (data.confirmed) s.confirm();
      else data.session = s;
    }
    function endSession(reason) {
      session = null; clearInterval(tick); tick = null; releaseWake(); rows.clear(); samples.clear();
      if (dead) return;
      view = 'home'; data = {}; note = reason || 'Disconnected.'; show();
    }

    async function act(name) {
      try {
        if (name === 'host') {
          view = 'hosting'; note = ''; data = {}; show();
          handle = await rtc.hostPairing({
            onCode: (c) => { data.code = c; if (view === 'hosting') show(); },
            onRequest: (r) => { data = { ...data, name: r.name, sas: r.sas, req: r }; view = 'request'; show(); },
            onSession: (s) => adopt(s, true),
            onError: (m) => fail(m)
          });
        } else if (name === 'accept') { const r = data.req; view = 'hosting'; note = ''; data.name = ''; root.innerHTML = shell('<div class="share-hero"><p class="share-wait">Connecting…</p></div>'); await r.accept(); }
        else if (name === 'reject') { data.req.reject(); view = 'hosting'; note = ''; show(); }
        else if (name === 'join') { view = 'joining'; note = ''; data = {}; show(); }
        else if (name === 'go') {
          const code = (data.typed || root.querySelector('.share-code-input')?.value || '').replace(/\D/g, '');
          if (code.length !== 6) { note = 'Enter the 6-digit code.'; show(); return; }
          note = ''; data.busy = true; show();
          handle = await rtc.joinPairing(code, {
            onSas: (sas) => { data = { sas, confirmed: false }; view = 'check'; show(); },
            onSession: (s) => adopt(s, false),
            onError: (m) => fail(m)
          });
        } else if (name === 'match') { data.confirmed = true; if (data.session) data.session.confirm(); show(); }
        else if (name === 'cancel') reset();
        else if (name === 'manual') { view = 'manual'; note = ''; show(); }
        else if (name === 'm-start') { view = 'manual-guest'; data = {}; show(); const g = await rtc.manualGuestStart(); handle = g; data.g = g; data.text = g.text; show(); }
        else if (name === 'm-paste') { view = 'manual-host'; data = {}; note = ''; show(); }
        else if (name === 'copy') { try { await navigator.clipboard.writeText(data.text); dialogs.toast('Copied'); } catch { root.querySelector('.share-text')?.select(); } }
        else if (name === 'm-finish') {
          const txt = root.querySelector('.share-reply').value.trim(); if (!txt) return;
          data.busy = true; note = ''; show();
          const { sas, session: p } = await data.g.finish(txt);
          data = { sas, confirmed: false, g: data.g }; view = 'check'; show();
          p.then((s) => adopt(s, false), (e) => fail(e.message === 'NOCONNECT' ? 'Could not connect directly. Both devices need to be on the same network.' : e.message));
        } else if (name === 'm-answer') {
          const txt = root.querySelector('.share-reply').value.trim(); if (!txt) return;
          data.busy = true; note = ''; show();
          const h = await rtc.manualHostAccept(txt);
          handle = h; data = { text: h.text, sas: h.sas, connecting: true }; show();
          h.session.then((s) => adopt(s, true), (e) => { if (e.message !== 'CANCELLED') fail(e.message === 'NOCONNECT' ? 'Could not connect directly. Both devices need to be on the same network.' : e.message); });
        }
      } catch (e) { data.busy = false; note = String(e.message || e).replace(/^E[A-Z]+: /, ''); show(); }
    }

    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (b && !b.disabled) act(b.dataset.act);
    });

    // ------------------------------------------------------------ connected screen
    function showConnected() {
      root.innerHTML = `
        <div class="share-conn">
          <div class="share-bar">
            <div class="share-status"><span class="share-dot"></span><div><b>${esc(session.peerName || 'Another device')}</b><div class="share-route muted">Connected</div></div></div>
            <label class="share-auto"><input type="checkbox" ${session.autoAccept ? 'checked' : ''}> Accept incoming files automatically</label>
            <button class="app-btn" data-sact="disconnect">Disconnect</button>
          </div>
          <div class="share-drop" tabindex="0">
            <div class="share-drop-title">Drop files or folders here to send</div>
            <div class="share-drop-btns">
              <button class="app-btn primary" data-sact="files">Send files…</button>
              <button class="app-btn" data-sact="folder">Send folder…</button>
              <button class="app-btn" data-sact="os">From OS storage…</button>
            </div>
          </div>
          <div class="share-list app-list"><div class="app-empty share-empty">Nothing sent or received yet.</div></div>
          <div class="share-foot muted">Received files are saved in ${esc(rtc.RECEIVE_DIR)}</div>
        </div>`;
      rows.clear();
      for (const t of session.transfers.values()) upsert(t);
      session.route().then((r) => { const el = root.querySelector('.share-route'); if (el) el.textContent = ROUTE_TEXT[r] || ROUTE_TEXT.unknown; });
      root.querySelector('.share-auto input').addEventListener('change', (e) => { session.autoAccept = e.target.checked; });
      wireDrop(root.querySelector('.share-drop'));
      clearInterval(tick); tick = setInterval(refresh, 500);
    }

    function wireDrop(zone) {
      let depth = 0;
      zone.addEventListener('dragenter', (e) => { if (hasFiles(e)) { depth++; zone.classList.add('over'); e.preventDefault(); } });
      zone.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
      zone.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; zone.classList.remove('over'); } });
      zone.addEventListener('drop', async (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault(); e.stopPropagation(); depth = 0; zone.classList.remove('over');
        const { files } = await filesFromDrop(e);
        sendItems(rtc.toItems(files));
      });
    }

    root.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-sact]'); if (!b || !session) return;
      const a = b.dataset.sact;
      if (a === 'disconnect') { session.close(); }
      else if (a === 'files') sendItems(rtc.toItems(await pickFiles({ multiple: true })));
      else if (a === 'folder') sendItems(rtc.toItems(await pickFiles({ multiple: true, directory: true })));
      else if (a === 'os') {
        const path = await dialogs.filePicker('Send a file from OS storage', 'open', '/home/user/UPLOADS');
        if (path) { try { sendItems(await rtc.itemsFromVfs(path)); } catch (err) { dialogs.toast(String(err.message).replace(/^E[A-Z]+: /, ''), { danger: true }); } }
      } else if (a === 'accept') session.transfers.get(b.dataset.id)?.accept();
      else if (a === 'decline') session.transfers.get(b.dataset.id)?.decline();
      else if (a === 'cancel') session.transfers.get(b.dataset.id)?.cancel();
    });

    function sendItems(items) {
      if (!session || !items.length) return;
      session.send(items);
    }

    // ------------------------------------------------------------ transfer rows
    function rowHTML(t) {
      const n = t.files.length;
      const title = n === 1 ? t.files[0].path.split('/').pop() : `${n} files`;
      const arrow = t.dir === 'out' ? 'Sending' : 'Receiving';
      const pct = t.total ? Math.min(100, (t.bytes / t.total) * 100) : (t.state === 'done' ? 100 : 0);
      const st = { offered: 'Waiting for you to accept', waiting: 'Waiting for the other device to accept', active: arrow + '…', done: 'Done', failed: 'Failed', cancelled: 'Cancelled', declined: 'Declined' }[t.state];
      let detail = esc(st);
      if (t.state === 'active') {
        const sp = speedOf(t);
        detail = `${formatBytes(t.bytes)} of ${formatBytes(t.total)} · ${fmtSpeed(sp)} ${sp > 0 ? '· ' + fmtEta((t.total - t.bytes) / sp) : ''}`;
      } else if (t.state === 'done') {
        const secs = Math.max(0.001, (t.finished - t.started) / 1000);
        detail = `Done · ${formatBytes(t.total)} in ${secs < 10 ? secs.toFixed(1) : Math.round(secs)} s${t.total && secs > 0.3 ? ' (' + fmtSpeed(t.total / secs) + ')' : ''}${t.dir === 'in' ? ' · saved to ' + esc(t.savedTo) : ''}`;
      } else if (t.error) detail += ': ' + esc(t.error);
      let btns = '';
      if (t.state === 'offered') btns = `<button class="app-btn primary" data-sact="accept" data-id="${t.id}">Accept</button><button class="app-btn" data-sact="decline" data-id="${t.id}">Decline</button>`;
      else if (t.state === 'active' || t.state === 'waiting') btns = `<button class="app-btn" data-sact="cancel" data-id="${t.id}">Cancel</button>`;
      return `<div class="share-row-main"><div class="share-row-title"><span class="share-dir">${t.dir === 'out' ? '↑' : '↓'}</span><span class="truncate">${esc(title)}</span><span class="muted">${n > 1 ? formatBytes(t.total) : ''}${n === 1 ? formatBytes(t.total) : ''}</span></div>
        <div class="share-bar-track"><i style="width:${pct.toFixed(1)}%"></i></div>
        <div class="share-row-detail muted">${detail}</div></div><div class="share-row-btns">${btns}</div>`;
    }

    function speedOf(t) {
      const s = samples.get(t.id) || [];
      if (s.length < 2) return 0;
      const a = s[0], b = s[s.length - 1];
      return b.t > a.t ? ((b.b - a.b) / (b.t - a.t)) * 1000 : 0;
    }
    function sample(t) {
      const s = samples.get(t.id) || []; s.push({ t: performance.now(), b: t.bytes });
      while (s.length > 6) s.shift(); samples.set(t.id, s);
    }

    function upsert(t) {
      const list = root.querySelector('.share-list'); if (!list) return;
      list.querySelector('.share-empty')?.remove();
      let el = rows.get(t.id);
      if (!el) { el = document.createElement('div'); el.className = 'share-row'; rows.set(t.id, el); list.prepend(el); }
      el.innerHTML = rowHTML(t);
    }
    function refresh() {
      if (!session) return;
      let active = false;
      for (const t of session.transfers.values()) {
        if (t.state === 'active') { active = true; sample(t); upsert(t); }
      }
      if (active) takeWake(); else releaseWake();
    }

    async function takeWake() { try { if (!wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch { /* optional */ } }
    function releaseWake() { try { wakeLock?.release(); } catch { /* ignore */ } wakeLock = null; }

    ctx.onCleanup?.(() => { dead = true; clearInterval(tick); releaseWake(); try { handle?.cancel?.(); } catch { /* ignore */ } try { session?.close(); } catch { /* ignore */ } });
    show();
  }
};
