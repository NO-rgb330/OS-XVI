/* ============================================================
   Wikipedia — read the whole encyclopedia in a window.

   Uses Wikipedia's free public APIs (MediaWiki Action API + the REST
   "featured feed"). Article HTML is rebuilt by core/wikihtml.js so it can't
   restyle or script the OS, and is styled by css/wikipedia.css.
   ============================================================ */
import { iconHTML } from '../core/icons.js';
import { esc } from '../core/util.js';
import { sanitizeArticle, sanitizeInline, snippetFragment, validLang } from '../core/wikihtml.js';

const LANGS = [['en', 'English'], ['simple', 'Simple English'], ['ar', 'العربية'], ['bn', 'বাংলা'], ['cs', 'Čeština'], ['da', 'Dansk'],
  ['de', 'Deutsch'], ['el', 'Ελληνικά'], ['es', 'Español'], ['fa', 'فارسی'], ['fi', 'Suomi'], ['fr', 'Français'], ['he', 'עברית'],
  ['hi', 'हिन्दी'], ['hu', 'Magyar'], ['id', 'Bahasa Indonesia'], ['it', 'Italiano'], ['ja', '日本語'], ['ko', '한국어'],
  ['la', 'Latina'], ['ms', 'Bahasa Melayu'], ['nl', 'Nederlands'], ['no', 'Norsk'], ['pl', 'Polski'], ['pt', 'Português'],
  ['ro', 'Română'], ['ru', 'Русский'], ['sv', 'Svenska'], ['ta', 'தமிழ்'], ['th', 'ไทย'], ['tr', 'Türkçe'], ['uk', 'Українська'],
  ['vi', 'Tiếng Việt'], ['zh', '中文']];

const LANG_KEY = 'os16.wiki.lang';
const QUICK = [['Portal:Contents', 'All contents'], ['Category:Main topic classifications', 'Categories'], ['Wikipedia:Featured articles', 'Featured articles'],
  ['Portal:Current events', 'Current events'], ['Wikipedia:Contents/A–Z index', 'A–Z index'], ['Help:Contents', 'Help']];

const wikiHost = (lang) => `https://${lang}.wikipedia.org`;
const norm = (t) => String(t || '').replace(/_/g, ' ').trim();
const pageUrl = (lang, title) => `${wikiHost(lang)}/wiki/${encodeURIComponent(norm(title).replace(/ /g, '_')).replace(/%2F/g, '/').replace(/%3A/g, ':')}`;

class ApiError extends Error { constructor(msg, code) { super(msg); this.code = code; } }

/** fetch() with a timeout that keeps "user navigated away" (rethrown) apart from "Wikipedia is unreachable" (ApiError). */
async function getJson(url, signal, ms = 40000) {
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), ms);
  const relay = () => c.abort();
  signal?.addEventListener('abort', relay);
  try {
    const r = await fetch(url, { signal: c.signal });
    if (!r.ok) throw new ApiError(`Wikipedia answered with error ${r.status}.`, 'http');
    try { return await r.json(); } catch { throw new ApiError('Wikipedia sent a response that could not be read.', 'badjson'); }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (signal?.aborted) throw e;                                   // the user moved on
    throw new ApiError(e.name === 'AbortError'
      ? 'Wikipedia took too long to answer.'
      : 'Couldn’t connect to Wikipedia. It may be blocked on your network, or temporarily unavailable.', 'network');
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', relay); }
}

async function api(lang, params, signal) {
  const u = new URL(`${wikiHost(lang)}/w/api.php`);
  u.search = new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params }).toString();
  const j = await getJson(u, signal);
  if (j.error) throw new ApiError(j.error.info || j.error.code, j.error.code);
  return j;
}

const isTransport = (e) => e instanceof ApiError && ['network', 'http', 'badjson'].includes(e.code);

export const wikipediaApp = {
  id: 'wikipedia',
  name: 'Wikipedia',
  icon: 'book',
  defaultSize: [1000, 680],

  launch(body, args, ctx) {
    let lang = 'en';
    try { const s = localStorage.getItem(LANG_KEY); if (s && validLang(s)) lang = s; } catch { /* storage unavailable */ }
    if (args?.lang && validLang(args.lang)) lang = args.lang;

    const hist = [];          // { type: 'home' | 'article' | 'search', lang, title, frag, query, scroll }
    let pos = -1;
    let ctl = null;           // abort controller of the load in progress
    const cache = new Map();  // "lang:title" → parse result (small LRU)
    let current = null;       // { langlinks } for the visible article
    let suggestCtl = null, suggestTimer = 0, suggestions = [], activeSug = -1;

    body.innerHTML = `
      <div class="wp-app">
        <div class="app-toolbar wp-toolbar">
          <button class="toolbar-btn" id="wp-back" title="Back (Alt+←)" aria-label="Back" disabled>${iconHTML('chevron-left')}</button>
          <button class="toolbar-btn" id="wp-fwd" title="Forward (Alt+→)" aria-label="Forward" disabled>${iconHTML('chevron-right')}</button>
          <button class="toolbar-btn" id="wp-home" title="Home" aria-label="Home">${iconHTML('home')}</button>
          <button class="toolbar-btn" id="wp-reload" title="Reload" aria-label="Reload">${iconHTML('refresh')}</button>
          <div class="wp-searchbox">
            <input type="search" class="app-input" id="wp-search" placeholder="Search Wikipedia  ( / )" autocomplete="off" spellcheck="false"
                   role="combobox" aria-expanded="false" aria-controls="wp-suggest" aria-label="Search Wikipedia">
            <div class="wp-suggest" id="wp-suggest" role="listbox" hidden></div>
          </div>
          <button class="toolbar-btn" id="wp-random" title="Random article">Random</button>
          <select class="app-input wp-lang" id="wp-lang" title="Wikipedia language" aria-label="Wikipedia language"></select>
        </div>
        <div class="wp-main" id="wp-main" tabindex="-1">
          <aside class="wp-toc" id="wp-toc" aria-label="Contents" hidden></aside>
          <div class="wp-scroll" id="wp-scroll"><div class="wp-view" id="wp-view"></div></div>
        </div>
        <div class="app-statusbar">
          <span class="sb-cell grow" id="wp-status">Ready</span>
          <span class="sb-cell">Text: Wikipedia, CC BY-SA 4.0</span>
        </div>
      </div>`;

    const $ = (s) => body.querySelector(s);
    const view = $('#wp-view'), scroller = $('#wp-scroll'), tocEl = $('#wp-toc');
    const search = $('#wp-search'), sugEl = $('#wp-suggest'), langSel = $('#wp-lang');
    const btnBack = $('#wp-back'), btnFwd = $('#wp-fwd');
    const setStatus = (t) => { $('#wp-status').textContent = t; };

    const options = [...LANGS];
    if (!options.some(([c]) => c === lang)) options.push([lang, lang]);
    langSel.innerHTML = options.map(([c, n]) => `<option value="${esc(c)}">${esc(n)} (${esc(c)})</option>`).join('');
    langSel.value = lang;

    // ---------- history ----------
    function syncNav() { btnBack.disabled = pos <= 0; btnFwd.disabled = pos >= hist.length - 1; }
    function saveScroll() { if (hist[pos]) hist[pos].scroll = scroller.scrollTop; }
    function go(entry, { replace = false } = {}) {
      saveScroll();
      if (replace && pos >= 0) hist[pos] = entry;
      else { hist.length = pos + 1; hist.push(entry); pos = hist.length - 1; }
      syncNav();
      return show(entry);
    }
    const goArticle = (l, title, frag = '') => go({ type: 'article', lang: l, title: norm(title), frag });
    const goSearch = (q, l = lang) => go({ type: 'search', lang: l, query: q });
    const goHome = () => go({ type: 'home', lang });

    function step(d) {
      const n = pos + d;
      if (n < 0 || n >= hist.length) return;
      saveScroll();
      pos = n; syncNav();
      show(hist[pos], true);
    }

    function setLang(l, persist = true) {
      if (!validLang(l)) return;
      lang = l;
      if (![...langSel.options].some((o) => o.value === l)) langSel.add(new Option(`${l} (${l})`, l));
      langSel.value = l;
      if (persist) { try { localStorage.setItem(LANG_KEY, l); } catch { /* storage unavailable */ } }
    }

    // ---------- views ----------
    async function show(entry, restore = false) {
      ctl?.abort();
      const my = ctl = new AbortController();
      tocEl.hidden = true;
      current = null;
      if (entry.lang && entry.lang !== lang) setLang(entry.lang);
      try {
        if (entry.type === 'home') await showHome(entry, my.signal);
        else if (entry.type === 'search') await showSearch(entry, my.signal);
        else await showArticle(entry, my.signal);
        if (my.signal.aborted) return;
        scroller.scrollTop = restore ? entry.scroll || 0 : 0;
        if (!restore && entry.frag) scrollToId('wp-' + entry.frag);
      } catch (e) {
        if (my.signal.aborted || e.name === 'AbortError') return;
        showError(entry, e);
      }
    }

    function loading(text) {
      view.innerHTML = `<div class="app-empty wp-loading"><div class="wp-spinner" aria-hidden="true"></div><div>${esc(text)}</div></div>`;
      setStatus(text);
    }

    function showError(entry, e) {
      const missing = e.code === 'missingtitle' || e.code === 'invalidtitle';
      const network = e instanceof ApiError && ['network', 'http', 'badjson'].includes(e.code);
      const bug = !(e instanceof ApiError);
      if (bug) console.error('Wikipedia app error', e);
      const head = missing ? 'No page with that title' : network ? 'Couldn’t load this page' : bug ? 'This page couldn’t be displayed' : 'Wikipedia reported a problem';
      const detail = missing ? `“${entry.title}” doesn’t exist on this Wikipedia.`
        : network ? `${e.message} Your connection may be fine — very large pages sometimes fail, so trying again or opening it on Wikipedia can help.`
        : bug ? `Unexpected error: ${e.message}` : e.message;
      view.innerHTML = `
        <div class="app-empty wp-error">
          ${iconHTML('info', 40)}
          <div><strong>${esc(head)}</strong></div>
          <div class="muted wp-error-detail">${esc(detail)}</div>
          <div class="wp-error-actions">
            ${missing ? '<button class="app-btn primary" data-search>Search for it</button>' : '<button class="app-btn primary" data-retry>Try again</button>'}
            ${entry.type === 'article' ? `<a class="app-btn" href="${esc(pageUrl(entry.lang, entry.title))}" target="_blank" rel="noopener noreferrer">Open on Wikipedia</a>` : ''}
          </div>
        </div>`;
      view.querySelector('[data-retry]')?.addEventListener('click', () => {
        if (entry.type === 'article') cache.delete(`${entry.lang}:${entry.title}`);
        show(entry);
      });
      view.querySelector('[data-search]')?.addEventListener('click', () => go({ type: 'search', lang: entry.lang, query: entry.title }, { replace: true }));
      setStatus('Failed to load');
      ctx.setTitle('Wikipedia');
    }

    // ---- Article ----
    const PARSE = { action: 'parse', redirects: '1', disableeditsection: '1', disabletoc: '1', disablelimitreport: '1', maxage: '3600', smaxage: '3600' };

    /** Very large articles can time out when fetched in one piece: fetch them one top-level section at a time. */
    async function fetchBySections(l, title, signal) {
      const head = (await api(l, { ...PARSE, page: title, prop: 'sections|displaytitle|langlinks|categories' }, signal)).parse;
      const secs = (head.sections || []).filter((x) => x.toclevel === 1 && x.index);
      const ids = ['0', ...secs.map((x) => x.index)];
      const parts = new Array(ids.length);
      let next = 0, failed = 0;
      const worker = async () => {
        while (next < ids.length) {
          const i = next++;
          try {
            const j = await api(l, { ...PARSE, page: title, prop: 'text', section: ids[i] }, signal);
            parts[i] = j.parse?.text || '';
          } catch (e) {
            if (signal.aborted) throw e;
            failed++;
            parts[i] = `<p><i>[This part of the article could not be loaded. Try reloading.]</i></p>`;
          }
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      if (failed === ids.length) throw new ApiError('Wikipedia did not answer.', 'network');
      return { ...head, text: parts.join('\n') };
    }

    /** Last resort: Wikipedia's REST endpoint (different servers, same content). */
    async function fetchRest(l, title, signal) {
      const c = new AbortController();
      const relay = () => c.abort(); signal.addEventListener('abort', relay);
      const timer = setTimeout(() => c.abort(), 45000);
      try {
        const r = await fetch(`${wikiHost(l)}/api/rest_v1/page/html/${encodeURIComponent(title.replace(/ /g, '_'))}`, { signal: c.signal });
        if (r.status === 404) throw new ApiError('There is no page with that title.', 'missingtitle');
        if (!r.ok) throw new ApiError(`Wikipedia answered with error ${r.status}.`, 'http');
        return { title, displaytitle: esc(title), text: await r.text(), langlinks: [], categories: [] };
      } catch (e) {
        if (e instanceof ApiError || signal.aborted) throw e;
        throw new ApiError('Couldn’t connect to Wikipedia.', 'network');
      } finally { clearTimeout(timer); signal.removeEventListener('abort', relay); }
    }

    async function fetchArticle(l, title, signal, fresh) {
      const key = `${l}:${title}`;
      if (!fresh && cache.has(key)) { const v = cache.get(key); cache.delete(key); cache.set(key, v); return v; }
      let res;
      try {
        const j = await api(l, { ...PARSE, page: title, prop: 'text|displaytitle|langlinks|categories' }, signal);
        res = j.parse;
        if (!res) throw new ApiError('Empty response from Wikipedia.', 'empty');
      } catch (first) {
        if (signal.aborted || !isTransport(first)) throw first;
        setStatus('Retrying in smaller pieces…');
        try { res = await fetchBySections(l, title, signal); }
        catch (second) {
          if (signal.aborted) throw second;
          if (!isTransport(second)) throw second;
          setStatus('Trying another Wikipedia server…');
          try { res = await fetchRest(l, title, signal); } catch (third) { if (signal.aborted) throw third; throw first; }
        }
      }
      cache.set(key, res);
      if (cache.size > 20) cache.delete(cache.keys().next().value);
      return res;
    }

    async function showArticle(entry, signal, fresh = false) {
      loading(`Loading “${entry.title}”…`);
      const res = await fetchArticle(entry.lang, entry.title, signal, fresh);
      if (signal.aborted) return;
      const finalTitle = norm(res.title);
      const requested = norm(entry.title);
      const redirected = requested.toLowerCase() !== finalTitle.toLowerCase();
      entry.title = finalTitle;   // history keeps the canonical title

      const article = sanitizeArticle(res.text, entry.lang);
      const heading = document.createElement('h1');
      heading.className = 'wp-title';
      heading.append(sanitizeInline(res.displaytitle || esc(finalTitle), entry.lang));

      const langlinks = (res.langlinks || []).filter((l) => validLang(l.lang));
      current = { langlinks, title: finalTitle };

      const meta = document.createElement('div');
      meta.className = 'wp-meta';
      meta.innerHTML = `<span>From Wikipedia, the free encyclopedia</span>` +
        (redirected ? `<span class="wp-redirect">Redirected from ${esc(requested)}</span>` : '') +
        (langlinks.length ? `<button type="button" class="app-btn wp-langs-btn" data-langs>${iconHTML('web')} ${langlinks.length} languages</button>` : '') +
        `<a class="app-btn" href="${esc(pageUrl(entry.lang, finalTitle))}" target="_blank" rel="noopener noreferrer">Open on Wikipedia</a>`;

      const cats = (res.categories || []).filter((c) => !c.hidden);
      const catBox = document.createElement('div');
      catBox.className = 'wp-cats';
      if (cats.length) {
        catBox.append('Categories: ');
        cats.forEach((c, i) => {
          const a = document.createElement('a');
          a.href = '#'; a.textContent = norm(c.category);
          a.dataset.wpTitle = 'Category:' + norm(c.category); a.dataset.wpLang = entry.lang;
          catBox.append(i ? ' · ' : '', a);
        });
      }

      const foot = document.createElement('div');
      foot.className = 'wp-foot';
      foot.innerHTML = `This text is from Wikipedia and available under the <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a> licence. ` +
        `Images may carry their own licences — open an image to see its file page. ` +
        `<a href="${esc(pageUrl(entry.lang, finalTitle))}?action=history" target="_blank" rel="noopener noreferrer">Authors &amp; history</a>.`;

      view.replaceChildren(heading, meta, article, ...(cats.length ? [catBox] : []), foot);
      view.dataset.kind = 'article';
      buildToc(article);
      ctx.setTitle(`${finalTitle} — Wikipedia`);
      setStatus(`${finalTitle} · ${entry.lang}.wikipedia.org`);
    }

    function buildToc(article) {
      const heads = [...article.querySelectorAll('h2[id], h3[id], h4[id]')]
        .filter((h) => !h.closest('.wpc-infobox, .wpc-navbox, .wpc-sidebar, table'));
      if (heads.length < 3) { tocEl.hidden = true; return; }
      tocEl.innerHTML = '<div class="wp-toc-title">Contents</div>' +
        heads.map((h) => `<a href="#" class="wp-toc-l${h.localName[1] - 1}" data-id="${esc(h.id)}">${esc(h.textContent)}</a>`).join('');
      tocEl.hidden = false;
    }

    // ---- Search ----
    async function showSearch(entry, signal, more = 0) {
      if (!more) loading(`Searching for “${entry.query}”…`);
      const j = await api(entry.lang, {
        action: 'query', list: 'search', srsearch: entry.query, srlimit: '20', sroffset: String(more),
        srprop: 'snippet|wordcount|timestamp', srinfo: 'totalhits|suggestion|rewrittenquery', srenablerewrites: '1'
      }, signal);
      if (signal.aborted) return;
      const results = j.query?.search || [];
      const info = j.query?.searchinfo || {};
      const next = j.continue?.sroffset;

      if (!more) {
        view.innerHTML = '';
        view.dataset.kind = 'search';
        const h = document.createElement('h1');
        h.className = 'wp-title';
        h.textContent = `Search results`;
        const sub = document.createElement('div');
        sub.className = 'wp-meta';
        sub.innerHTML = `<span>${(info.totalhits ?? results.length).toLocaleString()} results for “${esc(entry.query)}”</span>` +
          (info.suggestion ? `<span>Did you mean <a href="#" data-q="${esc(info.suggestion)}">${esc(info.suggestion)}</a>?</span>` : '');
        const list = document.createElement('ol');
        list.className = 'wp-results'; list.id = 'wp-results';
        view.append(h, sub, list);
        ctx.setTitle(`${entry.query} — Wikipedia search`);
      }
      const list = view.querySelector('#wp-results');
      if (!results.length && !more) {
        view.querySelector('#wp-results').outerHTML = `<div class="app-empty">${iconHTML('search', 40)}<div>No results found.</div></div>`;
      }
      for (const r of results) {
        const li = document.createElement('li');
        li.className = 'wp-result';
        const a = document.createElement('a');
        a.href = '#'; a.className = 'wp-result-title'; a.textContent = r.title;
        a.dataset.wpTitle = r.title; a.dataset.wpLang = entry.lang;
        const snip = document.createElement('div');
        snip.className = 'wp-result-snippet';
        snip.append(snippetFragment(r.snippet));
        const m = document.createElement('div');
        m.className = 'wp-result-meta muted';
        m.textContent = `${(r.wordcount || 0).toLocaleString()} words · ${r.timestamp ? new Date(r.timestamp).toLocaleDateString() : ''}`;
        li.append(a, snip, m);
        list.append(li);
      }
      view.querySelector('.wp-more')?.remove();
      if (next) {
        const b = document.createElement('button');
        b.className = 'app-btn wp-more'; b.textContent = 'Load more results';
        b.addEventListener('click', async () => {
          b.disabled = true; b.textContent = 'Loading…';
          try { await showSearch(entry, ctl.signal, next); } catch (e) { b.disabled = false; b.textContent = 'Retry loading more'; view.append(b); }
        });
        view.append(b);
      }
      setStatus(`Search: ${entry.query}`);
    }

    // ---- Home ----
    async function fetchFeed(l, signal) {
      for (let back = 0; back < 3; back++) {
        const d = new Date(Date.now() - back * 864e5);
        const path = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
        const r = await fetch(`${wikiHost(l)}/api/rest_v1/feed/featured/${path}`, { signal });
        if (r.ok) return r.json();
        if (r.status !== 404) break;
      }
      return null;
    }

    const card = (p, { views } = {}) => {
      if (!p?.title) return null;
      const t = norm(p.title);
      const el = document.createElement('a');
      el.href = '#'; el.className = 'wp-card';
      el.dataset.wpTitle = t; el.dataset.wpLang = lang;
      const thumb = p.thumbnail?.source;
      const img = thumb && /^https:\/\/[\w.-]*wikimedia\.org\//.test(thumb)
        ? `<img src="${esc(thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<div class="wp-card-noimg">${iconHTML('file-text', 24)}</div>`;
      el.innerHTML = `${img}<div class="wp-card-text"><div class="wp-card-title">${esc(p.displaytitle ? '' : t)}</div>
        <div class="wp-card-desc muted">${esc(p.description || '')}</div>${views ? `<div class="wp-card-desc muted">${views.toLocaleString()} views</div>` : ''}</div>`;
      if (p.displaytitle) el.querySelector('.wp-card-title').append(sanitizeInline(p.displaytitle, lang));
      return el;
    };

    async function showHome(entry, signal) {
      loading('Loading Wikipedia…');
      let feed = null;
      try { feed = await fetchFeed(entry.lang, signal); } catch (e) { if (e.name === 'AbortError') throw e; }
      if (signal.aborted) return;

      view.innerHTML = '';
      view.dataset.kind = 'home';
      const hero = document.createElement('div');
      hero.className = 'wp-hero';
      hero.innerHTML = `<div class="wp-hero-icon">${iconHTML('book', 40)}</div><h1 class="wp-title">Wikipedia</h1>
        <p class="muted">The free encyclopedia — search above, or explore below.</p>
        <div class="wp-quick">${QUICK.map(([t, l]) => `<a href="#" data-wp-title="${esc(t)}" data-wp-lang="${esc(entry.lang)}">${esc(l)}</a>`).join('')}</div>`;
      view.append(hero);

      const section = (title, ...nodes) => {
        const s = document.createElement('section');
        s.className = 'wp-section';
        const h = document.createElement('h2'); h.textContent = title;
        s.append(h, ...nodes.filter(Boolean));
        view.append(s);
        return s;
      };

      if (!feed) {
        section('Featured content', Object.assign(document.createElement('p'), { className: 'muted', textContent: 'Daily highlights aren’t available for this language. Use search or the links above.' }));
      } else {
        if (feed.tfa) {
          const c = card(feed.tfa);
          const ex = document.createElement('p'); ex.className = 'wp-extract'; ex.textContent = feed.tfa.extract || '';
          section('Today’s featured article', c, ex);
        }
        if (feed.image) {
          const f = feed.image;
          const src = f.thumbnail?.source;
          if (src && /^https:\/\/[\w.-]*wikimedia\.org\//.test(src)) {
            const fig = document.createElement('figure');
            fig.className = 'wp-potd';
            const a = document.createElement('a');
            a.href = '#'; a.dataset.wpTitle = f.title; a.dataset.wpLang = lang;
            a.innerHTML = `<img src="${esc(src)}" alt="${esc(f.description?.text || f.title)}" loading="lazy" referrerpolicy="no-referrer">`;
            const cap = document.createElement('figcaption');
            cap.textContent = f.description?.text || '';
            fig.append(a, cap);
            section('Picture of the day', fig);
          }
        }
        if (feed.mostread?.articles?.length) {
          const grid = document.createElement('div'); grid.className = 'wp-grid';
          feed.mostread.articles.filter((a) => !/^(Main Page|Special:|Wikipedia:|Portal:)/.test(a.title || '')).slice(0, 12)
            .forEach((a) => { const c = card(a, { views: a.views }); if (c) grid.append(c); });
          section('Most read', grid);
        }
        if (feed.news?.length) {
          const ul = document.createElement('ul'); ul.className = 'wp-news';
          for (const n of feed.news.slice(0, 6)) {
            const li = document.createElement('li');
            const root = sanitizeArticle(n.story || '', entry.lang);
            li.append(...root.childNodes);
            ul.append(li);
          }
          section('In the news', ul);
        }
        if (feed.onthisday?.length) {
          const ul = document.createElement('ul'); ul.className = 'wp-otd';
          for (const ev of feed.onthisday.slice(0, 8)) {
            const li = document.createElement('li');
            const y = document.createElement('strong'); y.textContent = `${ev.year}  `;
            li.append(y, ev.text || '');
            const first = ev.pages?.[0];
            if (first?.title) {
              const a = document.createElement('a');
              a.href = '#'; a.textContent = ` → ${norm(first.title)}`; a.dataset.wpTitle = norm(first.title); a.dataset.wpLang = lang;
              li.append(a);
            }
            ul.append(li);
          }
          section('On this day', ul);
        }
      }
      ctx.setTitle('Wikipedia');
      setStatus(feed ? 'Today on Wikipedia' : 'Ready');
    }

    // ---------- scrolling & TOC ----------
    function scrollToId(id) {
      const el = view.querySelector(`[id="${CSS.escape(id)}"]`);
      if (!el) return false;
      const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 8;
      scroller.scrollTo({ top, behavior: 'smooth' });
      return true;
    }

    let raf = 0;
    scroller.addEventListener('scroll', () => {
      if (raf || tocEl.hidden) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const base = scroller.getBoundingClientRect().top + 24;
        let active = null;
        for (const a of tocEl.querySelectorAll('a[data-id]')) {
          const h = view.querySelector(`[id="${CSS.escape(a.dataset.id)}"]`);
          if (h && h.getBoundingClientRect().top <= base) active = a;
        }
        tocEl.querySelectorAll('a.active').forEach((x) => x !== active && x.classList.remove('active'));
        active?.classList.add('active');
      });
    });
    ctx.onCleanup(() => cancelAnimationFrame(raf));

    // ---------- clicks inside content ----------
    body.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (!a || !body.contains(a)) return;

      if (a.dataset.wpTitle) {
        e.preventDefault();
        const next = { type: 'article', lang: a.dataset.wpLang || lang, title: norm(a.dataset.wpTitle), frag: a.dataset.wpFrag || '', from: hist[pos]?.title };
        // Same page + fragment: just scroll.
        const cur = hist[pos];
        if (cur?.type === 'article' && cur.lang === next.lang && norm(cur.title).toLowerCase() === next.title.toLowerCase() && next.frag) {
          scrollToId('wp-' + next.frag); return;
        }
        go(next);
      } else if (a.dataset.wpQuery) {
        e.preventDefault(); goSearch(a.dataset.wpQuery, a.dataset.wpLang || lang);
      } else if (a.dataset.wpAnchor) {
        e.preventDefault(); scrollToId(a.dataset.wpAnchor);
      } else if (a.dataset.id && tocEl.contains(a)) {
        e.preventDefault(); scrollToId(a.dataset.id);
      } else if (a.dataset.q) {
        e.preventDefault(); goSearch(a.dataset.q);
      } else if (a.getAttribute('href') === '#') {
        e.preventDefault();
      }
    });

    // ---------- languages popover ----------
    let pop = null;
    function closePop() { pop?.remove(); pop = null; }
    body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-langs]');
      if (!b) { if (pop && !pop.contains(e.target)) closePop(); return; }
      if (pop) return closePop();
      const links = current?.langlinks || [];
      pop = document.createElement('div');
      pop.className = 'wp-pop';
      pop.innerHTML = `<input type="search" class="app-input" placeholder="Filter ${links.length} languages" aria-label="Filter languages"><div class="wp-pop-list"></div>`;
      const listEl = pop.querySelector('.wp-pop-list');
      const fill = (q = '') => {
        const f = q.trim().toLowerCase();
        listEl.innerHTML = '';
        for (const l of links) {
          const name = l.autonym || l.langname || l.lang;
          if (f && !`${name} ${l.langname || ''} ${l.lang} ${l.title}`.toLowerCase().includes(f)) continue;
          const x = document.createElement('button');
          x.type = 'button'; x.className = 'wp-pop-item';
          x.innerHTML = `<span>${esc(name)}</span><span class="muted">${esc(l.title)}</span>`;
          x.addEventListener('click', () => { closePop(); goArticle(l.lang, l.title); });
          listEl.append(x);
        }
      };
      fill();
      pop.querySelector('input').addEventListener('input', (ev) => fill(ev.target.value));
      b.parentElement.style.position = 'relative';
      b.after(pop);
      pop.querySelector('input').focus();
    });

    // ---------- search box & suggestions ----------
    function hideSuggest() { sugEl.hidden = true; search.setAttribute('aria-expanded', 'false'); activeSug = -1; }
    function renderSuggest() {
      if (!suggestions.length) return hideSuggest();
      sugEl.innerHTML = '';
      suggestions.forEach((s, i) => {
        const row = document.createElement('div');
        row.className = 'wp-sug' + (i === activeSug ? ' active' : '');
        row.setAttribute('role', 'option');
        const th = s.thumbnail?.source;
        row.innerHTML = (th && /^https:\/\/[\w.-]*wikimedia\.org\//.test(th) ? `<img src="${esc(th)}" alt="" referrerpolicy="no-referrer">` : `<span class="wp-sug-noimg"></span>`) +
          `<span class="wp-sug-text"><span class="wp-sug-title">${esc(s.title)}</span><span class="wp-sug-desc muted">${esc(s.description || '')}</span></span>`;
        row.addEventListener('mousedown', (ev) => { ev.preventDefault(); chooseSuggestion(s.title); });
        sugEl.append(row);
      });
      sugEl.hidden = false;
      search.setAttribute('aria-expanded', 'true');
    }
    function chooseSuggestion(title) {
      search.value = '';
      hideSuggest();
      goArticle(lang, title);
      scroller.focus?.();
    }
    function onType() {
      clearTimeout(suggestTimer);
      const q = search.value.trim();
      if (!q) { suggestions = []; return hideSuggest(); }
      suggestTimer = setTimeout(async () => {
        suggestCtl?.abort();
        const c = suggestCtl = new AbortController();
        try {
          const j = await api(lang, {
            action: 'query', generator: 'prefixsearch', gpssearch: q, gpslimit: '8', gpsnamespace: '0',
            prop: 'pageimages|description', piprop: 'thumbnail', pithumbsize: '64', pilimit: '8'
          }, c.signal);
          suggestions = (j.query?.pages || []).sort((a, b) => (a.index || 0) - (b.index || 0));
          activeSug = -1;
          renderSuggest();
        } catch { /* typeahead is best effort */ }
      }, 160);
    }
    search.addEventListener('input', onType);
    search.addEventListener('blur', () => setTimeout(hideSuggest, 120));
    search.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!suggestions.length) return;
        e.preventDefault();
        activeSug = (activeSug + (e.key === 'ArrowDown' ? 1 : -1) + suggestions.length + 1) % (suggestions.length + 1) ;
        if (activeSug === suggestions.length) activeSug = -1;
        renderSuggest();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const q = search.value.trim();
        if (activeSug >= 0 && suggestions[activeSug]) return chooseSuggestion(suggestions[activeSug].title);
        if (!q) return;
        search.value = '';
        hideSuggest();
        goSearch(q);
      } else if (e.key === 'Escape') {
        if (!sugEl.hidden) { hideSuggest(); e.stopPropagation(); }
      }
    });

    // ---------- toolbar ----------
    btnBack.onclick = () => step(-1);
    btnFwd.onclick = () => step(1);
    $('#wp-home').onclick = goHome;
    $('#wp-reload').onclick = () => {
      const e = hist[pos];
      if (!e) return;
      ctl?.abort(); const my = ctl = new AbortController();
      if (e.type === 'article') { cache.delete(`${e.lang}:${e.title}`); showArticle(e, my.signal, true).catch((er) => !my.signal.aborted && showError(e, er)); }
      else show(e);
    };
    $('#wp-random').onclick = async () => {
      setStatus('Finding a random article…');
      try {
        const j = await api(lang, { action: 'query', list: 'random', rnnamespace: '0', rnlimit: '1' });
        const t = j.query?.random?.[0]?.title;
        if (t) goArticle(lang, t);
      } catch (e) { setStatus('Couldn’t reach Wikipedia'); }
    };
    langSel.addEventListener('change', () => { setLang(langSel.value); goHome(); });

    body.addEventListener('keydown', (e) => {
      const typing = e.target.matches('input, textarea, select');
      if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      else if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); search.focus(); search.select(); }
      else if (e.key === '/' && !typing) { e.preventDefault(); search.focus(); }
      else if (e.key === 'Escape' && pop) closePop();
    });

    ctx.onCleanup(() => { ctl?.abort(); suggestCtl?.abort(); clearTimeout(suggestTimer); });

    // ---------- start ----------
    if (args?.title) goArticle(lang, args.title);
    else if (args?.query) goSearch(args.query);
    else goHome();
  }
};
