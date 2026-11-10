/* ============================================================
   YouTube — search and watch videos without an account.

   Finding videos goes down a fallback chain until something answers:
     1. Invidious instances   (JSON API)
     2. Piped instances       (JSON API)
     3. youtube.com results page, fetched through a CORS proxy and parsed here
     4. nothing worked → "search unavailable" screen where you can paste a link
   Within a tier the instances are raced with a short head start for the first,
   so one dead server doesn't stall the others. The video itself plays in an
   embedded player, which needs no search API at all — so pasted links always work.
   ============================================================ */
import { iconHTML } from '../core/icons.js';
import { esc } from '../core/util.js';

const KEY = 'os16.yt.v1';

// Public instances change often. These are starting points; the lists are editable in Settings.
const DEFAULTS = {
  invidious: ['https://inv.nadeko.net', 'https://invidious.nerdvpn.de', 'https://yt.chocolatemoo53.com'],
  piped: ['https://pipedapi.kavin.rocks', 'https://pipedapi.leptons.xyz', 'https://pipedapi.adminforge.de'],
  proxies: ['https://corsproxy.io/?url=', 'https://api.allorigins.win/raw?url='],
  player: 'youtube'                       // 'youtube' (youtube-nocookie embed) | 'invidious'
};

const cleanList = (v, fallback, keepTail = false) => {
  if (!Array.isArray(v)) return [...fallback];
  const out = [];
  for (const s of v) {
    let t = String(s || '').trim();
    if (!/^https:\/\/[^\s/]+/i.test(t)) continue;
    if (!keepTail) t = t.replace(/\/+$/, '');
    if (!out.includes(t)) out.push(t);
  }
  return out;
};
function loadCfg() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch { /* none saved */ }
  s = s && typeof s === 'object' ? s : {};
  return {
    invidious: cleanList(s.invidious, DEFAULTS.invidious),
    piped: cleanList(s.piped, DEFAULTS.piped),
    proxies: cleanList(s.proxies, DEFAULTS.proxies, true),
    player: s.player === 'invidious' ? 'invidious' : 'youtube'
  };
}

// ---------- helpers ----------
const ID_RE = /^[\w-]{11}$/;
export function parseVideoId(input) {
  const t = String(input || '').trim();
  if (ID_RE.test(t)) return t;
  let u;
  try { u = new URL(/^[a-z]+:\/\//i.test(t) ? t : 'https://' + t); } catch { return null; }
  const host = u.hostname.replace(/^(www|m|music)\./, '');
  let id = null;
  if (host === 'youtu.be') id = u.pathname.split('/')[1];
  else if (/(^|\.)(youtube(-nocookie)?\.com|piped\.[\w.-]+|invidious\.[\w.-]+)$/.test(host) || /^(inv|yt)\./.test(host)) {
    id = u.searchParams.get('v');
    if (!id) { const m = /^\/(?:shorts|embed|live|v|watch)\/([\w-]{11})/.exec(u.pathname); if (m) id = m[1]; }
  }
  return id && ID_RE.test(id) ? id : null;
}
const looksLikeLink = (s) => /^(https?:\/\/|www\.|youtu\.be\/|(m\.|music\.)?youtube\.com)/i.test(s.trim());

const hostOf = (u) => { try { return new URL(u).host; } catch { return u; } };
const thumb = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
const pad = (n) => String(n).padStart(2, '0');
function fmtDur(s) {
  s = Math.floor(+s);
  if (!Number.isFinite(s) || s < 0) return '';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const fmtViews = (n) => (Number.isFinite(+n) && +n >= 0 && n !== null && n !== '' ? `${compact.format(+n)} views` : '');
const htmlToText = (h) => {
  const s = String(h || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n');
  return (new DOMParser().parseFromString(s, 'text/html').body.textContent || '').trim();
};

// ---------- network ----------
function aborted() { const e = new Error('aborted'); e.aborted = true; return e; }

async function getText(url, signal, ms = 7000) {
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), ms);
  const relay = () => c.abort();
  signal?.addEventListener('abort', relay);
  try {
    const r = await fetch(url, { signal: c.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } catch (e) {
    if (signal?.aborted) throw aborted();
    throw new Error(e.name === 'AbortError' ? 'timed out' : e.message === 'Failed to fetch' ? 'blocked or offline' : e.message);
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', relay); }
}
async function getJson(url, signal, ms) {
  const t = await getText(url, signal, ms);
  try { return JSON.parse(t); } catch { throw new Error('not JSON (API disabled?)'); }
}

/** Start task 0 now, the next after `stagger` ms (or as soon as one fails); first success wins, the rest are cancelled. */
function firstOk(tasks, stagger, outer) {
  return new Promise((resolve, reject) => {
    if (!tasks.length) return reject(Object.assign(new Error('none configured'), { all: [] }));
    const ctls = [], timers = [], errs = [];
    let next = 0, fails = 0, done = false;
    const finish = (fn, v) => {
      if (done) return;
      done = true; timers.forEach(clearTimeout); ctls.forEach((c) => c.abort()); outer?.removeEventListener('abort', onOuter); fn(v);
    };
    const onOuter = () => finish(reject, aborted());
    if (outer?.aborted) return reject(aborted());
    outer?.addEventListener('abort', onOuter);
    const launch = () => {
      if (done || next >= tasks.length) return;
      const i = next++, c = new AbortController();
      ctls.push(c);
      tasks[i](c.signal).then((v) => finish(resolve, v), (e) => {
        if (done || e?.aborted) return;
        errs.push(e); fails++;
        if (fails === tasks.length) finish(reject, Object.assign(new Error('all failed'), { all: errs }));
        else launch();
      });
      if (next < tasks.length) timers.push(setTimeout(launch, stagger));
    };
    launch();
  });
}

class ChainError extends Error { constructor(failures) { super('All sources failed'); this.failures = failures; } }

// ============================================================
export const youtubeApp = {
  id: 'youtube',
  name: 'YouTube',
  icon: 'video',
  defaultSize: [1040, 700],

  launch(body, args, ctx) {
    let cfg = loadCfg();
    const lastGood = {};                   // base → true; tried first next time
    const cooldown = new Map();            // base → timestamp of last failure
    const hist = []; let pos = -1;
    let ctl = null, nav = 0;
    const cache = new Map();

    body.innerHTML = `
      <div class="yt-app">
        <div class="app-toolbar yt-toolbar">
          <button class="toolbar-btn" id="yt-back" title="Back" aria-label="Back" disabled>${iconHTML('chevron-left')}</button>
          <button class="toolbar-btn" id="yt-fwd" title="Forward" aria-label="Forward" disabled>${iconHTML('chevron-right')}</button>
          <button class="toolbar-btn" id="yt-home" title="Home" aria-label="Home">${iconHTML('home')}</button>
          <form class="yt-searchbox" id="yt-form">
            <input type="search" class="app-input" id="yt-q" placeholder="Search, or paste a YouTube link" autocomplete="off" spellcheck="false" aria-label="Search YouTube or paste a link">
            <button type="submit" class="app-btn primary yt-go">${iconHTML('search', 14)} Search</button>
          </form>
          <button class="toolbar-btn" id="yt-settings" title="Sources and player" aria-label="Settings">${iconHTML('settings')}</button>
        </div>
        <div class="yt-scroll" id="yt-scroll"><div class="yt-view" id="yt-view"></div></div>
        <div class="yt-panel" id="yt-panel" hidden></div>
        <div class="app-statusbar"><span class="sb-cell grow" id="yt-status">Ready</span><span class="sb-cell">Video: YouTube</span></div>
      </div>`;
    const $ = (s) => body.querySelector(s);
    const view = $('#yt-view'), scroller = $('#yt-scroll'), q = $('#yt-q'), panel = $('#yt-panel');
    const btnBack = $('#yt-back'), btnFwd = $('#yt-fwd');
    const setStatus = (t) => { $('#yt-status').textContent = t; };

    // ---------- the fallback chain ----------
    const order = (list) => {
      const now = Date.now();
      const rank = (b) => (lastGood[b] ? 0 : (cooldown.get(b) || 0) > now - 300000 ? 2 : 1);
      return [...list].sort((a, b) => rank(a) - rank(b));
    };
    const bad = (b) => cooldown.set(b, Date.now());

    /** ops: { inv(base, sig), piped(base, sig), scrape(proxy, sig) } — any may be omitted. */
    async function chain(ops, signal) {
      const tiers = [];
      if (ops.inv) tiers.push({ name: 'Invidious', list: order(cfg.invidious), run: (b) => (sig) => ops.inv(b, sig).then((v) => ({ v, b, label: `Invidious · ${hostOf(b)}`, kind: 'inv' })), mark: true });
      if (ops.piped) tiers.push({ name: 'Piped', list: order(cfg.piped), run: (b) => (sig) => ops.piped(b, sig).then((v) => ({ v, b, label: `Piped · ${hostOf(b)}`, kind: 'piped' })), mark: true });
      if (ops.scrape) tiers.push({ name: 'YouTube page via proxy', list: cfg.proxies, run: (p) => (sig) => ops.scrape(p, sig).then((v) => ({ v, b: p, label: `YouTube page · ${hostOf(p)}`, kind: 'scrape' })), mark: false });
      const failures = [];
      for (const t of tiers) {
        if (signal?.aborted) throw aborted();
        if (!t.list.length) { failures.push({ tier: t.name, host: '—', msg: 'no instances configured' }); continue; }
        const tasks = t.list.map((b) => (sig) => t.run(b)(sig).catch((e) => { if (!e.aborted) { e.host = hostOf(b); if (t.mark) bad(b); } throw e; }));
        try {
          const r = await firstOk(tasks, t.name === 'Invidious' || t.name === 'Piped' ? 2500 : 4000, signal);
          if (t.mark) lastGood[r.b] = true;
          return r;
        } catch (e) {
          if (e.aborted) throw e;
          (e.all || []).forEach((x) => failures.push({ tier: t.name, host: x.host || '?', msg: x.message }));
        }
      }
      throw new ChainError(failures);
    }

    // ---------- normalisers ----------
    const normInv = (v) => {
      if (!v || (v.type && v.type !== 'video') || !ID_RE.test(v.videoId || '')) return null;
      return { id: v.videoId, title: v.title || 'Untitled', author: v.author || '', views: v.viewCount ?? null, when: v.publishedText || '', dur: v.lengthSeconds, live: !!v.liveNow };
    };
    const normPiped = (v) => {
      if (!v || (v.type && v.type !== 'stream')) return null;
      let id = null;
      try { id = new URL(v.url || '', 'https://x.invalid').searchParams.get('v'); } catch { /* bad url */ }
      if (!ID_RE.test(id || '')) return null;
      return { id, title: v.title || 'Untitled', author: v.uploaderName || '', views: v.views ?? null, when: v.uploadedDate || '', dur: v.duration, live: v.duration === -1 };
    };
    const list = (arr, fn) => (Array.isArray(arr) ? arr.map(fn).filter(Boolean) : null);

    /** Scrape tier: pull ytInitialData out of the results page and walk it for videoRenderer objects. */
    function parseResultsPage(html) {
      const at = html.indexOf('ytInitialData');
      if (at < 0) throw new Error('page had no data (consent or bot check?)');
      const start = html.indexOf('{', at);
      let depth = 0, inStr = false, esc_ = false, end = -1;
      for (let i = start; i < html.length; i++) {
        const ch = html[i];
        if (inStr) { if (esc_) esc_ = false; else if (ch === '\\') esc_ = true; else if (ch === '"') inStr = false; continue; }
        if (ch === '"') inStr = true;
        else if (ch === '{') depth++;
        else if (ch === '}' && --depth === 0) { end = i + 1; break; }
      }
      if (end < 0) throw new Error('page data was cut off');
      const data = JSON.parse(html.slice(start, end));
      const out = [], seen = new Set();
      const txt = (o) => o?.simpleText ?? o?.runs?.map((r) => r.text).join('') ?? '';
      (function walk(o, d) {
        if (!o || typeof o !== 'object' || d > 40) return;
        if (Array.isArray(o)) { o.forEach((x) => walk(x, d + 1)); return; }
        const r = o.videoRenderer;
        if (r && ID_RE.test(r.videoId || '') && !seen.has(r.videoId)) {
          seen.add(r.videoId);
          const dur = txt(r.lengthText).split(':').reverse().reduce((s, p, i) => s + (+p || 0) * 60 ** i, 0);
          out.push({ id: r.videoId, title: txt(r.title) || 'Untitled', author: txt(r.ownerText) || txt(r.longBylineText), views: null, viewsText: txt(r.viewCountText), when: txt(r.publishedTimeText), dur: txt(r.lengthText) ? dur : -1, live: !r.lengthText });
        }
        for (const k in o) walk(o[k], d + 1);
      })(data, 0);
      return out;
    }

    // ---------- data operations ----------
    const enc = encodeURIComponent;
    const opSearch = (text, page = 1) => ({
      inv: async (b, s) => { const a = list(await getJson(`${b}/api/v1/search?q=${enc(text)}&type=video&page=${page}`, s), normInv); if (!a) throw new Error('unexpected reply'); return a; },
      piped: page > 1 ? null : async (b, s) => { const j = await getJson(`${b}/search?q=${enc(text)}&filter=videos`, s); const a = list(j.items, normPiped); if (!a) throw new Error('unexpected reply'); return a; },
      scrape: page > 1 ? null : async (p, s) => parseResultsPage(await getText(`${p}${enc(`https://www.youtube.com/results?search_query=${enc(text)}&sp=EgIQAQ%3D%3D&hl=en`)}`, s, 9000))
    });
    const opTrending = () => ({
      inv: async (b, s) => { const a = list(await getJson(`${b}/api/v1/trending`, s), normInv); if (!a?.length) throw new Error('no trending data'); return a; },
      piped: async (b, s) => { const a = list(await getJson(`${b}/trending?region=US`, s), normPiped); if (!a?.length) throw new Error('no trending data'); return a; }
    });
    const opDetails = (id) => ({
      inv: async (b, s) => {
        const j = await getJson(`${b}/api/v1/videos/${id}`, s, 9000);
        if (!j.title) throw new Error('unexpected reply');
        return { title: j.title, author: j.author, views: j.viewCount, likes: j.likeCount, when: j.publishedText, desc: String(j.description || ''), related: list(j.recommendedVideos, normInv) || [] };
      },
      piped: async (b, s) => {
        const j = await getJson(`${b}/streams/${id}`, s, 9000);
        if (!j.title) throw new Error('unexpected reply');
        return { title: j.title, author: j.uploader, views: j.views, likes: j.likes, when: j.uploadDate, desc: htmlToText(j.description), related: list(j.relatedStreams, normPiped) || [] };
      }
    });

    // ---------- history ----------
    const syncNav = () => { btnBack.disabled = pos <= 0; btnFwd.disabled = pos >= hist.length - 1; };
    function go(entry) {
      hist.length = pos + 1; hist.push(entry); pos = hist.length - 1;
      syncNav(); show(entry);
    }
    function step(d) { const n = pos + d; if (n < 0 || n >= hist.length) return; pos = n; syncNav(); show(hist[pos]); }
    const goHome = () => go({ type: 'home' });
    const goSearch = (text) => go({ type: 'search', q: text });
    const goWatch = (id, title) => go({ type: 'watch', id, title });

    function submit(raw) {
      const t = raw.trim();
      if (!t) return;
      if (looksLikeLink(t) || ID_RE.test(t)) {
        const id = parseVideoId(t);
        if (id) return goWatch(id);
        if (looksLikeLink(t)) return toast('That link doesn’t look like a YouTube video.');
      }
      goSearch(t);
    }
    const toast = (m) => { setStatus(m); };

    // ---------- views ----------
    function begin() {
      ctl?.abort(); ctl = new AbortController();
      return { my: ++nav, signal: ctl.signal };
    }
    const stale = (my) => my !== nav;

    function loading(msg) {
      view.innerHTML = `<div class="app-empty yt-loading"><div class="wp-spinner" aria-hidden="true"></div><div>${esc(msg)}</div></div>`;
    }

    function card(v) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'yt-card';
      const th = document.createElement('div'); th.className = 'yt-thumb';
      const img = document.createElement('img');
      img.src = thumb(v.id); img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', () => img.remove());
      th.append(img);
      const d = v.live ? 'LIVE' : fmtDur(v.dur);
      if (d) { const t = document.createElement('span'); t.className = 'yt-dur' + (v.live ? ' live' : ''); t.textContent = d; th.append(t); }
      const info = document.createElement('div'); info.className = 'yt-info';
      const title = document.createElement('div'); title.className = 'yt-title'; title.textContent = v.title;
      const meta = document.createElement('div'); meta.className = 'yt-meta muted';
      meta.textContent = [v.author, v.viewsText || fmtViews(v.views), v.when].filter(Boolean).join(' · ');
      info.append(title, meta);
      b.append(th, info);
      b.addEventListener('click', () => goWatch(v.id, v.title));
      return b;
    }
    function grid(items) {
      const g = document.createElement('div'); g.className = 'yt-grid';
      items.forEach((v) => g.append(card(v)));
      return g;
    }

    function unavailable(err, retry) {
      const rows = (err.failures || []).map((f) => `<li><strong>${esc(f.tier)}</strong> · ${esc(f.host)} — ${esc(f.msg)}</li>`).join('');
      view.innerHTML = `
        <div class="app-empty yt-unavail">
          ${iconHTML('warning', 40)}
          <div><strong>Search unavailable right now</strong></div>
          <div class="muted yt-unavail-text">Every search source failed. Public instances go up and down all the time. You can still watch a video by pasting its link.</div>
          <form class="yt-paste" id="yt-paste">
            <input class="app-input" id="yt-paste-in" placeholder="Paste a YouTube link or video ID" spellcheck="false" aria-label="YouTube link">
            <button type="submit" class="app-btn primary">Play</button>
          </form>
          <div class="yt-actions">
            <button type="button" class="app-btn" id="yt-retry">Try again</button>
            <button type="button" class="app-btn" id="yt-open-set">Edit sources</button>
          </div>
          ${rows ? `<details class="yt-why"><summary>What was tried</summary><ul>${rows}</ul></details>` : ''}
        </div>`;
      const inp = view.querySelector('#yt-paste-in');
      view.querySelector('#yt-paste').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = parseVideoId(inp.value);
        if (id) goWatch(id); else { inp.setCustomValidity('Not a YouTube video link'); inp.reportValidity(); inp.addEventListener('input', () => inp.setCustomValidity(''), { once: true }); }
      });
      view.querySelector('#yt-retry').addEventListener('click', retry);
      view.querySelector('#yt-open-set').addEventListener('click', openSettings);
      setStatus('Search unavailable');
    }

    async function showHome() {
      const { my, signal } = begin();
      ctx.setTitle('YouTube');
      loading('Loading popular videos…');
      setStatus('Looking for a working source…');
      try {
        const r = cache.get('home') || await chain(opTrending(), signal);
        if (stale(my)) return;
        cache.set('home', r);
        view.innerHTML = '<h2 class="yt-h">Popular right now</h2>';
        view.append(grid(r.v));
        setStatus(`Showing ${r.v.length} videos via ${r.label}`);
      } catch (e) {
        if (e.aborted || stale(my)) return;
        unavailable(e, showHome);
      }
      scroller.scrollTop = 0;
    }

    async function showSearch(entry) {
      const { my, signal } = begin();
      ctx.setTitle(`${entry.q} — YouTube`);
      q.value = entry.q;
      loading(`Searching for “${entry.q}”…`);
      setStatus('Looking for a working source…');
      try {
        const key = 's:' + entry.q;
        const r = cache.get(key) || await chain(opSearch(entry.q), signal);
        if (stale(my)) return;
        cache.set(key, r); if (cache.size > 30) cache.delete(cache.keys().next().value);
        view.innerHTML = '';
        const h = document.createElement('h2'); h.className = 'yt-h'; h.textContent = `Results for “${entry.q}”`;
        view.append(h);
        if (!r.v.length) { view.insertAdjacentHTML('beforeend', '<div class="app-empty"><div>No videos found.</div><div class="muted">Try different words.</div></div>'); setStatus(`No results · ${r.label}`); return; }
        const g = grid(r.v); view.append(g);
        let seen = new Set(r.v.map((v) => v.id)), page = 1;
        if (r.kind === 'inv') {            // Invidious can page; the other tiers return one page
          const more = document.createElement('button'); more.type = 'button'; more.className = 'app-btn yt-more'; more.textContent = 'Load more';
          more.addEventListener('click', async () => {
            more.disabled = true; more.textContent = 'Loading…';
            try {
              const a = await getJson(`${r.b}/api/v1/search?q=${enc(entry.q)}&type=video&page=${page + 1}`, signal);
              const items = (list(a, normInv) || []).filter((v) => !seen.has(v.id));
              if (stale(my)) return;
              page++; items.forEach((v) => { seen.add(v.id); g.append(card(v)); });
              if (!items.length) more.remove(); else { more.disabled = false; more.textContent = 'Load more'; }
            } catch (e) { if (!e.aborted) { more.disabled = false; more.textContent = 'Couldn’t load more — try again'; } }
          });
          view.append(more);
        }
        setStatus(`${r.v.length} results via ${r.label}`);
      } catch (e) {
        if (e.aborted || stale(my)) return;
        unavailable(e, () => showSearch(entry));
      }
      scroller.scrollTop = 0;
    }

    const playerSrc = (id) => cfg.player === 'invidious'
      ? `${order(cfg.invidious)[0] || DEFAULTS.invidious[0]}/embed/${id}?autoplay=1`
      : `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;

    async function showWatch(entry) {
      const { my, signal } = begin();
      const id = entry.id;
      ctx.setTitle(entry.title ? `${entry.title} — YouTube` : 'YouTube');
      view.innerHTML = `
        <div class="yt-watch">
          <div class="yt-main">
            <div class="yt-player" id="yt-player"></div>
            <h2 class="yt-vtitle" id="yt-vtitle"></h2>
            <div class="yt-vmeta muted" id="yt-vmeta"></div>
            <div class="yt-vactions">
              <a class="app-btn" id="yt-ext" target="_blank" rel="noopener noreferrer">Open on YouTube</a>
              <button type="button" class="app-btn" id="yt-swap"></button>
            </div>
            <div class="yt-desc" id="yt-desc" hidden></div>
          </div>
          <aside class="yt-related" id="yt-related" aria-label="Related videos"></aside>
        </div>`;
      const player = view.querySelector('#yt-player');
      const mount = () => {
        player.innerHTML = '';
        const f = document.createElement('iframe');
        f.src = playerSrc(id); f.title = 'Video player';
        f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        f.allowFullscreen = true;
        f.referrerPolicy = 'strict-origin-when-cross-origin';
        f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox');
        player.append(f);
        const sw = view.querySelector('#yt-swap');
        sw.textContent = cfg.player === 'invidious' ? 'Use YouTube player' : 'Use Invidious player';
      };
      mount();
      view.querySelector('#yt-vtitle').textContent = entry.title || 'Video';
      const ext = view.querySelector('#yt-ext'); ext.href = `https://www.youtube.com/watch?v=${id}`;
      view.querySelector('#yt-swap').addEventListener('click', () => {
        cfg.player = cfg.player === 'invidious' ? 'youtube' : 'invidious';
        persist(); mount();
      });
      scroller.scrollTop = 0;
      setStatus('Playing · loading details…');

      try {
        const r = cache.get('d:' + id) || await chain(opDetails(id), signal);
        if (stale(my)) return;
        cache.set('d:' + id, r);
        const d = r.v;
        ctx.setTitle(`${d.title} — YouTube`);
        view.querySelector('#yt-vtitle').textContent = d.title;
        view.querySelector('#yt-vmeta').textContent = [d.author, fmtViews(d.views), d.likes > 0 ? `${compact.format(d.likes)} likes` : '', d.when].filter(Boolean).join(' · ');
        const desc = view.querySelector('#yt-desc');
        if (d.desc) {
          desc.hidden = false; desc.textContent = d.desc;
          if (d.desc.length > 280 || d.desc.split('\n').length > 4) {
            desc.classList.add('collapsed');
            desc.addEventListener('click', () => desc.classList.toggle('collapsed'));
            desc.title = 'Click to expand';
          }
        }
        const rel = view.querySelector('#yt-related');
        rel.innerHTML = '';
        d.related.filter((v) => v.id !== id).slice(0, 20).forEach((v) => rel.append(card(v)));
        setStatus(`Playing · details via ${r.label}`);
      } catch (e) {
        if (e.aborted || stale(my)) return;
        view.querySelector('#yt-related').innerHTML = '<div class="muted yt-norel">Details and related videos are unavailable right now. The video still plays.</div>';
        setStatus('Playing · details unavailable');
      }
    }

    function show(entry) {
      closePanel();
      if (entry.type === 'home') { q.value = ''; return showHome(); }
      if (entry.type === 'search') return showSearch(entry);
      return showWatch(entry);
    }

    // ---------- settings ----------
    function persist() { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch { /* storage unavailable */ } }
    function closePanel() { panel.hidden = true; panel.innerHTML = ''; }
    function openSettings() {
      panel.hidden = false;
      panel.innerHTML = `
        <div class="yt-panel-card" role="dialog" aria-label="Sources and player">
          <div class="yt-panel-head"><strong>Sources and player</strong><button type="button" class="toolbar-btn" id="yt-pclose" aria-label="Close">${iconHTML('close')}</button></div>
          <div class="yt-panel-body">
            <p class="muted">Search tries these in order: Invidious, then Piped, then the YouTube page through a proxy. One address per line, https only.</p>
            <label>Invidious instances<textarea class="app-textarea" id="yt-s-inv" rows="3" spellcheck="false"></textarea></label>
            <label>Piped API addresses<textarea class="app-textarea" id="yt-s-piped" rows="3" spellcheck="false"></textarea></label>
            <label>CORS proxies <span class="muted">(prefix; the page address is appended, encoded)</span><textarea class="app-textarea" id="yt-s-prox" rows="2" spellcheck="false"></textarea></label>
            <label>Video player
              <select class="app-input" id="yt-s-player">
                <option value="youtube">YouTube (privacy-enhanced embed)</option>
                <option value="invidious">Invidious embed (first instance above)</option>
              </select>
            </label>
            <div class="yt-actions">
              <button type="button" class="app-btn primary" id="yt-s-save">Save</button>
              <button type="button" class="app-btn" id="yt-s-reset">Reset to defaults</button>
            </div>
          </div>
        </div>`;
      const fill = (c) => {
        panel.querySelector('#yt-s-inv').value = c.invidious.join('\n');
        panel.querySelector('#yt-s-piped').value = c.piped.join('\n');
        panel.querySelector('#yt-s-prox').value = c.proxies.join('\n');
        panel.querySelector('#yt-s-player').value = c.player;
      };
      fill(cfg);
      const lines = (id) => panel.querySelector(id).value.split('\n');
      panel.querySelector('#yt-pclose').addEventListener('click', closePanel);
      panel.addEventListener('click', (e) => { if (e.target === panel) closePanel(); });
      panel.querySelector('#yt-s-save').addEventListener('click', () => {
        cfg = {
          invidious: cleanList(lines('#yt-s-inv'), []), piped: cleanList(lines('#yt-s-piped'), []),
          proxies: cleanList(lines('#yt-s-prox'), [], true), player: panel.querySelector('#yt-s-player').value === 'invidious' ? 'invidious' : 'youtube'
        };
        cooldown.clear(); cache.clear(); persist(); closePanel(); setStatus('Sources saved');
      });
      panel.querySelector('#yt-s-reset').addEventListener('click', () => fill({ ...DEFAULTS }));
    }

    // ---------- wiring ----------
    $('#yt-form').addEventListener('submit', (e) => { e.preventDefault(); submit(q.value); });
    btnBack.addEventListener('click', () => step(-1));
    btnFwd.addEventListener('click', () => step(1));
    $('#yt-home').addEventListener('click', goHome);
    $('#yt-settings').addEventListener('click', () => (panel.hidden ? openSettings() : closePanel()));
    body.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !panel.hidden) { closePanel(); e.stopPropagation(); }
      else if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      else if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) { e.preventDefault(); q.focus(); q.select(); }
    });
    ctx.onCleanup(() => { ctl?.abort(); nav++; });

    // args: { url } or { query } so other apps/terminal can open a video
    const startId = args?.url ? parseVideoId(args.url) : null;
    if (startId) goWatch(startId); else if (args?.query) goSearch(String(args.query)); else goHome();
  }
};
