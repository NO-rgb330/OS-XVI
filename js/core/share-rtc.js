/* ============================================================
   Quick Share core — direct browser-to-browser file transfer.

   Pairing:   one device shows a 6-digit code, the other types it.
              The code only locates a small "mailbox" on a public
              signaling service (ntfy.sh by default) where the two
              browsers swap connection details. Files NEVER go
              through it. A manual copy/paste mode needs no service.
   Safety:    both screens show a 4-digit check number derived from
              the encryption fingerprints; a stranger who guesses
              the code can't produce a matching number.
   Transfer:  one WebRTC connection with several data channels.
              Files are cut into chunks that are spread across the
              channels, written to disk at their final position as
              they arrive (nothing is held in memory), with an
              acknowledgement window so the sender never runs far
              ahead of the receiver's disk.
   ============================================================ */

import * as vfs from './vfs.js';
import { joinPath, nameError } from './util.js';

export const RECEIVE_DIR = '/home/user/UPLOADS/Received';

const PROTOCOL = 1;
const TUNE = (() => { try { return JSON.parse(localStorage.getItem('os16.share.tune')) || {}; } catch { return {}; } })();
const CHUNK = Math.min(240 * 1024, Math.max(16 * 1024, TUNE.chunk | 0 || 240 * 1024));   // payload per message (Chrome allows up to 256 KB)
const CHANNELS = Math.min(16, Math.max(1, TUNE.channels | 0 || 4));                      // parallel data channels
const HIGH_WATER = 4 * 1024 * 1024;       // pause a channel when this much is queued on it
const LOW_WATER = 1 * 1024 * 1024;
const WINDOW = Math.max(4, TUNE.windowMB | 0 || 64) * 1024 * 1024;          // max bytes sent but not yet written by the receiver
const PAIR_TIMEOUT_MS = 25000;
const CODE_TTL_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------- config
const signalBase = () => (localStorage.getItem('os16.share.signal') || 'https://ntfy.sh').replace(/\/+$/, '');
function iceServers() {
  try { const o = JSON.parse(localStorage.getItem('os16.share.ice')); if (Array.isArray(o)) return o; } catch { /* default */ }
  return [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }];
}
export function deviceName() {
  try { const n = JSON.parse(localStorage.getItem('os16.config'))?.name; if (n) return String(n).slice(0, 40); } catch { /* none */ }
  return 'Another device';
}

// ---------------------------------------------------------------- small helpers
const enc = new TextEncoder();
async function sha256(text) { return new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text))); }
const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');

async function pack(obj) {
  const stream = new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
async function unpack(text) {
  const bin = atob(String(text).replace(/\s+/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return JSON.parse(await new Response(stream).text());
}

function fingerprint(sdp) { return /a=fingerprint:\S+ ([0-9A-Fa-f:]+)/.exec(sdp)?.[1]?.toUpperCase() || ''; }
async function checkNumber(offerSdp, answerSdp) {
  const h = await sha256(`${fingerprint(offerSdp)}|${fingerprint(answerSdp)}`);
  return String(new DataView(h.buffer).getUint32(0) % 10000).padStart(4, '0');
}

function gather(pc, maxMs = 3000) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    const done = () => { clearTimeout(timer); pc.removeEventListener('icegatheringstatechange', onState); resolve(); };
    const onState = () => { if (pc.iceGatheringState === 'complete') done(); };
    const timer = setTimeout(done, maxMs);
    pc.addEventListener('icegatheringstatechange', onState);
  });
}

function newPeerConnection() { return new RTCPeerConnection({ iceServers: iceServers() }); }

export function createCode() {
  const a = new Uint32Array(1); crypto.getRandomValues(a);
  return String(a[0] % 1000000).padStart(6, '0');
}
const randomId = () => hex(crypto.getRandomValues(new Uint8Array(8)));

// ---------------------------------------------------------------- signaling mailbox (ntfy-compatible)
async function topicFor(code) { return 'osxvi-' + hex(await sha256('osxvi-share-v1:' + code)).slice(0, 32); }

function listen(topic, onMessage, onError) {
  const startedAt = Date.now() / 1000;
  const es = new EventSource(`${signalBase()}/${topic}/sse?since=all`);
  es.onmessage = (e) => {
    try {
      const m = JSON.parse(e.data);
      if (m.event && m.event !== 'message') return;
      if (m.time && m.time < startedAt - 60 * 15) return;           // stale leftovers
      onMessage(JSON.parse(m.message));
    } catch { /* not ours */ }
  };
  es.onerror = () => { if (es.readyState === 2) onError?.(); };
  return () => es.close();
}
async function post(topic, obj) {
  const r = await fetch(`${signalBase()}/${topic}`, { method: 'POST', body: JSON.stringify(obj) });
  if (!r.ok) throw new Error('The pairing service refused the message (' + r.status + ')');
}

// ---------------------------------------------------------------- pairing
/**
 * Resolves with a Session once the check number is known and the control channel plus
 * every data channel are open. Rejects with NOCONNECT on timeout or ICE failure.
 */
function sessionWhenReady(pc, role, channels, peerName) {
  const need = 1 + CHANNELS;
  let sas = '', timer, resolve, reject, settled = false;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  promise.catch(() => {});
  const fail = (e) => { if (settled) return; settled = true; clearTimeout(timer); try { pc.close(); } catch { /* ignore */ } reject(e); };
  const check = () => {
    if (settled || !sas || channels.size < need) return;
    for (const dc of channels.values()) if (dc.readyState !== 'open') return;
    settled = true; clearTimeout(timer);
    resolve(new Session(pc, role, channels, sas, peerName));
  };
  const watch = (dc) => { dc.binaryType = 'arraybuffer'; channels.set(dc.label, dc); dc.addEventListener('open', check); check(); };
  timer = setTimeout(() => fail(new Error('NOCONNECT')), PAIR_TIMEOUT_MS);
  pc.addEventListener('connectionstatechange', () => { if (pc.connectionState === 'failed') fail(new Error('NOCONNECT')); });
  return { promise, watch, fail, setSas(v) { sas = v; check(); }, check };
}

/** Guest = the device that types the code: creates the channels and the offer. */
async function guestOffer() {
  const pc = newPeerConnection();
  const channels = new Map();
  const w = sessionWhenReady(pc, 'guest', channels, '');
  w.watch(pc.createDataChannel('ctl'));
  for (let i = 0; i < CHANNELS; i++) w.watch(pc.createDataChannel('d' + i, { ordered: false }));
  await pc.setLocalDescription(await pc.createOffer());
  await gather(pc);
  const offer = pc.localDescription.toJSON();
  return {
    offer,
    async applyAnswer(answer, peerName) {
      await pc.setRemoteDescription({ type: answer.type, sdp: answer.sdp });
      const sas = await checkNumber(offer.sdp, answer.sdp);
      w.peerName = peerName;
      const session = w.promise.then((s) => { s.peerName = peerName; return s; });
      w.setSas(sas);
      return { sas, session };
    },
    cancel() { w.fail(new Error('CANCELLED')); }
  };
}

/** Host = the device that shows the code: answers the guest's offer. */
async function hostAnswer(offer, peerName) {
  const pc = newPeerConnection();
  const channels = new Map();
  const w = sessionWhenReady(pc, 'host', channels, peerName);
  pc.addEventListener('datachannel', (e) => w.watch(e.channel));
  await pc.setRemoteDescription({ type: offer.type, sdp: offer.sdp });
  await pc.setLocalDescription(await pc.createAnswer());
  await gather(pc);
  const answer = pc.localDescription.toJSON();
  const sas = await checkNumber(offer.sdp, answer.sdp);
  w.setSas(sas);
  return { answer, sas, session: w.promise, cancel() { w.fail(new Error('CANCELLED')); } };
}

/**
 * Show-a-code side. Calls:
 *   onCode(code)            — display this code
 *   onRequest({name, sas, accept(), reject()}) — someone entered the code
 *   onSession(session)      — connected (call session.confirm() after the user checks the number)
 *   onError(message)
 */
export async function hostPairing({ onCode, onRequest, onSession, onError }) {
  const code = createCode();
  const topic = await topicFor(code);
  let busy = false, closed = false, current = null;
  const expire = setTimeout(() => { stop(); onError?.('This code expired. Start again for a new one.'); }, CODE_TTL_MS);
  const stop = () => { closed = true; clearTimeout(expire); unlisten(); current?.cancel(); };
  const unlisten = listen(topic, async (m) => {
    if (closed || busy || m.t !== 'offer' || !m.z) return;
    busy = true;
    try {
      const offer = await unpack(m.z);
      const h = await hostAnswer(offer, String(m.name || 'Another device').slice(0, 40));
      current = h;
      h.session.then((s) => { if (!closed) { stop(); onSession(s); } }, (e) => { if (!closed && e.message !== 'CANCELLED') { busy = false; onError?.(friendly(e)); } });
      onRequest({
        name: String(m.name || 'Another device').slice(0, 40),
        sas: h.sas,
        accept: async () => { try { await post(topic, { t: 'answer', to: m.id, z: await pack(h.answer), name: deviceName() }); } catch (e) { onError?.(friendly(e)); } },
        reject: () => { h.cancel(); current = null; busy = false; }
      });
    } catch (e) { busy = false; onError?.(friendly(e)); }
  }, () => onError?.('Could not reach the pairing service. Check your internet connection, or use manual pairing.'));
  onCode(code);
  return { code, cancel: stop };
}

/** Type-a-code side. Calls onSas(sas), onSession(session), onError(message). */
export async function joinPairing(code, { onSas, onSession, onError }) {
  const clean = String(code).replace(/\D/g, '');
  if (clean.length !== 6) throw new Error('Enter the 6-digit code.');
  const topic = await topicFor(clean);
  const myId = randomId();
  let closed = false;
  const g = await guestOffer();
  const timer = setTimeout(() => { if (!closed) { stop(); onError?.('Nobody answered. Check the code, and that the other device is showing it.'); } }, PAIR_TIMEOUT_MS + 5000);
  const stop = () => { closed = true; clearTimeout(timer); unlisten(); g.cancel(); };
  const unlisten = listen(topic, async (m) => {
    if (closed || m.t !== 'answer' || m.to !== myId || !m.z) return;
    closed = true; clearTimeout(timer); unlisten();
    try {
      const { sas, session } = await g.applyAnswer(await unpack(m.z), String(m.name || 'Another device').slice(0, 40));
      onSas?.(sas);
      onSession(await session);
    } catch (e) { onError?.(friendly(e)); }
  }, () => { if (!closed) { stop(); onError?.('Could not reach the pairing service. Check your internet connection, or use manual pairing.'); } });
  try { await post(topic, { t: 'offer', id: myId, name: deviceName(), z: await pack(g.offer) }); }
  catch (e) { stop(); throw new Error(friendly(e)); }
  return { cancel: stop };
}

// ---- manual pairing (no service at all: copy/paste the texts) ----
export async function manualGuestStart() {
  const g = await guestOffer();
  return {
    text: await pack({ ...g.offer, name: deviceName() }),
    async finish(answerText) {
      const a = await unpack(answerText);
      const { sas, session } = await g.applyAnswer({ type: a.type, sdp: a.sdp }, String(a.name || 'Another device').slice(0, 40));
      return { sas, session };
    },
    cancel: g.cancel
  };
}
export async function manualHostAccept(offerText) {
  const o = await unpack(offerText);
  const name = String(o.name || 'Another device').slice(0, 40);
  const h = await hostAnswer({ type: o.type, sdp: o.sdp }, name);
  return { text: await pack({ ...h.answer, name: deviceName() }), sas: h.sas, name, session: h.session, cancel: h.cancel };
}

function friendly(e) {
  const m = String(e?.message || e);
  if (m === 'NOCONNECT') return 'Could not connect directly. Both devices need to be on the same network, and some school or public Wi-Fi blocks devices from talking to each other.';
  if (/atob|JSON|Unexpected|deflate|invalid/i.test(m)) return 'That text is not a valid pairing code.';
  return m;
}

// ================================================================ Session
const TRANSFER_STATES = { offered: 1, waiting: 1, active: 1 };

export class Session {
  constructor(pc, role, channels, sas, peerName) {
    this.pc = pc; this.role = role; this.sas = sas; this.peerName = peerName;
    this.ctl = channels.get('ctl');
    this.data = [...channels.entries()].filter(([k]) => k.startsWith('d')).map(([, v]) => v);
    this.handlers = new Map();
    this.transfers = new Map();         // xid -> Transfer
    this.inFiles = new Map();           // fileId -> { t, f }
    this.nextFileId = 1;
    this.localOk = false; this.remoteOk = false; this.ready = false; this.closed = false;
    this.autoAccept = false;

    this.ctl.onmessage = (e) => { try { this._onCtl(JSON.parse(e.data)); } catch { /* ignore malformed */ } };
    for (const dc of this.data) { dc.bufferedAmountLowThreshold = LOW_WATER; dc.onmessage = (e) => this._onFrame(e.data); }
    const gone = () => this._close('The other device disconnected.');
    this.ctl.onclose = gone;
    pc.addEventListener('connectionstatechange', () => { if (['failed', 'closed'].includes(pc.connectionState)) gone(); });
  }

  on(ev, fn) { if (!this.handlers.has(ev)) this.handlers.set(ev, new Set()); this.handlers.get(ev).add(fn); return () => this.handlers.get(ev).delete(fn); }
  _emit(ev, ...a) { for (const fn of this.handlers.get(ev) ?? []) { try { fn(...a); } catch (e) { console.error(e); } } }
  _ctl(obj) { if (this.ctl.readyState === 'open') this.ctl.send(JSON.stringify(obj)); }

  /** The user has compared the 4-digit numbers and they match. */
  confirm() { this.localOk = true; this._ctl({ t: 'confirm' }); this._maybeReady(); }
  _maybeReady() { if (!this.ready && this.localOk && this.remoteOk) { this.ready = true; this._emit('ready'); } }

  /** 'direct-local' | 'direct-internet' | 'relay' | 'unknown' */
  async route() {
    try {
      const stats = await this.pc.getStats();
      let pairId = null; const byId = new Map();
      stats.forEach((r) => { byId.set(r.id, r); if (r.type === 'transport' && r.selectedCandidatePairId) pairId = r.selectedCandidatePairId; });
      let pair = pairId ? byId.get(pairId) : null;
      if (!pair) stats.forEach((r) => { if (r.type === 'candidate-pair' && r.nominated && r.state === 'succeeded') pair = r; });
      if (!pair) return 'unknown';
      const l = byId.get(pair.localCandidateId), r = byId.get(pair.remoteCandidateId);
      const types = [l?.candidateType, r?.candidateType];
      if (types.includes('relay')) return 'relay';
      if (types.every((t) => t === 'host')) return 'direct-local';
      if (types.includes('srflx') || types.includes('prflx')) return 'direct-internet';
      return 'unknown';
    } catch { return 'unknown'; }
  }

  close() { this._ctl({ t: 'bye' }); this._close('Disconnected.'); }
  _close(reason) {
    if (this.closed) return;
    this.closed = true;
    for (const t of this.transfers.values()) if (TRANSFER_STATES[t.state]) this._fail(t, reason, false);
    try { this.pc.close(); } catch { /* ignore */ }
    this._emit('closed', reason);
  }

  // ------------------------------------------------------------ sending
  /** items: [{ blob: Blob|File, path: 'folder/name.ext' }] */
  send(items) {
    const files = items.filter((i) => i.blob).map((i) => ({ id: this.nextFileId++, blob: i.blob, path: String(i.path || i.blob.name), size: i.blob.size }));
    if (!files.length) return null;
    const t = this._makeTransfer(randomId(), 'out', files);
    t.state = 'waiting';
    this._ctl({ t: 'offer', xid: t.id, chunk: CHUNK, files: files.map((f) => ({ id: f.id, path: f.path, size: f.size })) });
    this._emit('transfer', t);
    return t;
  }

  _makeTransfer(id, dir, files) {
    const total = files.reduce((n, f) => n + f.size, 0);
    const t = {
      id, dir, files, total, bytes: 0, state: 'offered', error: '', started: 0, finished: 0, savedTo: RECEIVE_DIR,
      cancelled: false, wake: [],
      cancel: () => { if (TRANSFER_STATES[t.state]) { this._ctl({ t: 'cancel', xid: id }); this._fail(t, 'Cancelled.', false, 'cancelled'); } },
      accept: () => this._acceptIncoming(t),
      decline: () => { this._ctl({ t: 'decline', xid: id }); t.state = 'declined'; this._emit('transfer', t); }
    };
    this.transfers.set(id, t);
    return t;
  }

  _wakeAll(t) { const w = t.wake; t.wake = []; for (const fn of w) fn(); }
  _fail(t, message, tell = true, state = 'failed') {
    if (!TRANSFER_STATES[t.state]) return;
    t.state = state; t.error = state === 'cancelled' ? '' : message; t.cancelled = true; t.finished = Date.now();
    if (tell) this._ctl({ t: 'fail', xid: t.id, message });
    this._wakeAll(t);
    for (const f of t.files) { if (f.writerP) f.writerP.then((w) => w.abort()).catch(() => {}); this.inFiles.delete(f.id); }
    this._emit('transfer', t);
  }

  async _runSend(t) {
    t.state = 'active'; t.started = Date.now(); this._emit('transfer', t);
    // Chunk queue across all files, in order.
    const jobs = [];
    for (const f of t.files) for (let i = 0, n = Math.ceil(f.size / CHUNK); i < n; i++) jobs.push({ f, i });
    let next = 0, sent = 0;
    t.sent = 0;
    const lowWait = (dc) => new Promise((res) => { dc.addEventListener('bufferedamountlow', res, { once: true }); });
    const worker = async (dc) => {
      while (!t.cancelled && !this.closed) {
        const job = jobs[next++]; if (!job) return;
        while (t.sent - t.bytes >= WINDOW && !t.cancelled) await new Promise((res) => t.wake.push(res));
        if (t.cancelled) return;
        const off = job.i * CHUNK, len = Math.min(CHUNK, job.f.size - off);
        const buf = await job.f.blob.slice(off, off + len).arrayBuffer();
        const frame = new Uint8Array(8 + len);
        const dv = new DataView(frame.buffer);
        dv.setUint32(0, job.f.id); dv.setUint32(4, job.i);
        frame.set(new Uint8Array(buf), 8);
        while (dc.bufferedAmount > HIGH_WATER && dc.readyState === 'open' && !t.cancelled) await lowWait(dc);
        if (dc.readyState !== 'open') throw new Error('The connection dropped.');
        dc.send(frame); t.sent += len; sent += len;
      }
    };
    try { await Promise.all(this.data.map(worker)); }
    catch (e) { this._fail(t, e.message || 'Send failed.'); }
  }

  // ------------------------------------------------------------ receiving
  async _acceptIncoming(t) {
    try {
      const total = t.total;
      await vfs.ensureSpace(total);
      await vfs.mkdir(RECEIVE_DIR).catch(() => {});
      await this._planTargets(t);
    } catch (e) {
      this._ctl({ t: 'decline', xid: t.id, message: e.message });
      t.state = 'failed'; t.error = String(e.message).replace(/^E[A-Z]+: /, ''); this._emit('transfer', t); return;
    }
    t.state = 'active'; t.started = Date.now();
    for (const f of t.files) { f.got = 0; f.nchunks = Math.ceil(f.size / t.chunk); this.inFiles.set(f.id, { t, f }); }
    this._ctl({ t: 'accept', xid: t.id });
    // Empty files carry no chunks: create them now.
    for (const f of t.files.filter((x) => x.size === 0)) this._finishFile(t, f);
    this._emit('transfer', t);
    this._checkComplete(t);
  }

  async _planTargets(t) {
    const dirsMade = new Set([RECEIVE_DIR]);
    const taken = new Map();
    const ensureDir = async (path) => {
      if (dirsMade.has(path)) return;
      const parent = path.slice(0, path.lastIndexOf('/'));
      await ensureDir(parent);
      await vfs.mkdir(path).catch(() => {});
      dirsMade.add(path);
    };
    for (const f of t.files) {
      const segs = f.path.split('/').map((s) => s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim()).filter((s) => s && s !== '.' && s !== '..');
      let name = segs.pop() || 'file';
      if (nameError(name)) name = 'file';
      let dir = RECEIVE_DIR;
      for (const s of segs.slice(0, 12)) dir = joinPath(dir, nameError(s) ? '_' : s);
      await ensureDir(dir);
      if (!taken.has(dir)) { let n = []; try { n = (await vfs.list(dir)).map((x) => x.name); } catch { /* new */ } taken.set(dir, new Set(n)); }
      const set = taken.get(dir);
      if (set.has(name)) {
        const dot = name.lastIndexOf('.');
        const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
        for (let i = 2; set.has(name); i++) name = `${stem} (${i})${ext}`;
      }
      set.add(name);
      f.target = joinPath(dir, name);
    }
  }

  _writer(t, f) { return (f.writerP ||= vfs.openWriter(f.target, f.size)); }

  async _finishFile(t, f) {
    try {
      const w = await this._writer(t, f);
      await w.close();
      f.done = true;
      this.inFiles.delete(f.id);
      this._checkComplete(t);
    } catch (e) { this._fail(t, String(e.message).replace(/^E[A-Z]+: /, '')); }
  }

  _checkComplete(t) {
    if (t.state !== 'active' || t.dir !== 'in') return;
    if (!t.files.every((f) => f.done)) return;
    t.state = 'done'; t.finished = Date.now(); t.bytes = t.total;
    this._sendAck(t, true);
    this._ctl({ t: 'complete', xid: t.id });
    this._emit('transfer', t);
  }

  _sendAck(t, now = false) {
    if (t.ackTimer && !now) return;
    const fire = () => { t.ackTimer = 0; this._ctl({ t: 'ack', xid: t.id, bytes: t.bytes }); };
    if (now) { clearTimeout(t.ackTimer); fire(); } else t.ackTimer = setTimeout(fire, 40);
  }

  async _onFrame(buf) {
    if (!(buf instanceof ArrayBuffer) || buf.byteLength < 8) return;
    const dv = new DataView(buf);
    const entry = this.inFiles.get(dv.getUint32(0));
    if (!entry) return;
    const { t, f } = entry, idx = dv.getUint32(4), len = buf.byteLength - 8;
    if (t.state !== 'active') return;
    try {
      const w = await this._writer(t, f);
      await w.write(idx * t.chunk, new Uint8Array(buf, 8, len));
    } catch (e) { return this._fail(t, String(e.message).replace(/^E[A-Z]+: /, '')); }
    if (t.state !== 'active') return;
    f.got += len; t.bytes += len;
    this._emit('progress', t);
    this._sendAck(t);
    if (f.got >= f.size && !f.closing) { f.closing = true; this._finishFile(t, f); }
  }

  // ------------------------------------------------------------ control messages
  _onCtl(m) {
    switch (m.t) {
      case 'confirm': this.remoteOk = true; this._maybeReady(); break;
      case 'bye': this._close('The other device disconnected.'); break;
      case 'offer': {
        if (!this.ready || this.transfers.has(m.xid) || !Array.isArray(m.files) || m.files.length > 100000) return;
        const files = m.files.map((f) => ({ id: f.id >>> 0, path: String(f.path || 'file').slice(0, 1000), size: Math.max(0, Number(f.size) || 0) }));
        const t = this._makeTransfer(String(m.xid), 'in', files);
        t.chunk = Math.min(Math.max(Number(m.chunk) || CHUNK, 1024), 1024 * 1024);
        this._emit('transfer', t);
        this._emit('incoming', t);
        if (this.autoAccept) t.accept();
        break;
      }
      case 'accept': { const t = this.transfers.get(m.xid); if (t?.dir === 'out' && t.state === 'waiting') this._runSend(t); break; }
      case 'decline': { const t = this.transfers.get(m.xid); if (t && TRANSFER_STATES[t.state]) { t.state = 'declined'; t.error = m.message || ''; t.cancelled = true; this._emit('transfer', t); } break; }
      case 'ack': { const t = this.transfers.get(m.xid); if (t?.dir === 'out') { t.bytes = Math.max(t.bytes, Math.min(t.total, Number(m.bytes) || 0)); this._wakeAll(t); this._emit('progress', t); } break; }
      case 'complete': { const t = this.transfers.get(m.xid); if (t?.dir === 'out' && t.state === 'active') { t.state = 'done'; t.bytes = t.total; t.finished = Date.now(); this._emit('transfer', t); } break; }
      case 'cancel': { const t = this.transfers.get(m.xid); if (t) this._fail(t, 'The other device cancelled.', false, 'cancelled'); break; }
      case 'fail': { const t = this.transfers.get(m.xid); if (t) this._fail(t, m.message || 'The other device reported an error.', false); break; }
    }
  }
}

// ================================================================ helpers for the UI
/** Flatten a dropped/picked list into [{blob, path}] keeping relative folder paths. */
export function toItems(files) {
  return Array.from(files).map((f) => ({ blob: f, path: f.webkitRelativePath || f.relativePath || f.name }));
}

/** Collect every file under a virtual-disk folder (or a single file) for sending. */
export async function itemsFromVfs(path) {
  const node = await vfs.stat(path);
  const base = path.slice(path.lastIndexOf('/') + 1);
  if (node.kind === 'file') return [{ blob: await vfs.read(path), path: base }];
  const out = [];
  const walk = async (dir, rel) => {
    for (const n of await vfs.list(dir)) {
      if (n.kind === 'dir') await walk(joinPath(dir, n.name), rel + '/' + n.name);
      else if (n.kind === 'file') out.push({ blob: await vfs.readNode(n), path: rel + '/' + n.name });
    }
  };
  await walk(path, base);
  return out;
}
