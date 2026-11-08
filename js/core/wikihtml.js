/* ============================================================
   Wikipedia HTML → safe DOM.

   Wikipedia's rendered HTML is untrusted input and was written for
   Wikipedia's own stylesheet. This module rebuilds it element by element:

     · only allow-listed tags and attributes are copied (nothing else survives)
     · every class gets a "wpc-" prefix and every id a "wp-" prefix, so article
       markup can neither pick up the OS's CSS nor clobber its element ids
     · inline styles are filtered down to harmless layout/colour properties
     · links are rewritten: wiki links navigate inside the app, others open in a
       new tab; javascript:/data: URLs are dropped
     · images/media may only come from Wikimedia hosts (no tracking pixels)
   ============================================================ */

const ALLOWED = new Set(('a abbr b bdi bdo big blockquote br caption center cite code col colgroup data dd del dfn details div dl dt ' +
  'em figcaption figure h1 h2 h3 h4 h5 h6 hr i img ins kbd li mark ol p pre q rp rt ruby s samp small span strike strong sub summary ' +
  'sup table tbody td tfoot th thead time tr tt u ul var wbr video audio source section article aside').split(' '));

// Removed together with everything inside them.
const DROP = new Set(('script style link meta base iframe frame frameset object embed applet form input button textarea select option ' +
  'noscript svg math template title head canvas dialog track').split(' '));

// Elements Wikipedia hides on screen or that only make sense on the live site.
const DROP_CLASS = new Set(['mw-editsection', 'mw-editsection-like', 'mw-jump-link', 'mw-indicators', 'printonly', 'printfooter',
  'mw-authority-control-hidden', 'navbar-ignore']);

const MEDIA_HOST = /(^|\.)(wikimedia|wikipedia|wikidata|wikisource|wikibooks|wiktionary|wikiquote|wikinews|wikiversity|wikivoyage|mediawiki)\.org$/i;
const WIKI_HOST = /^([a-z][a-z0-9-]{1,14})\.(?:m\.)?wikipedia\.org$/i;

export const validLang = (l) => typeof l === 'string' && /^[a-z]{2,12}(-[a-z0-9]+)*$/.test(l);

// ---------- URLs ----------
function mediaUrl(raw, lang) {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim(), `https://${lang}.wikipedia.org/`);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (!MEDIA_HOST.test(u.hostname)) return null;
    u.protocol = 'https:';
    return u.href;
  } catch { return null; }
}

/** Classify a link found in an article. */
export function resolveLink(href, lang) {
  if (!href) return null;
  href = href.trim();
  if (href.startsWith('#')) return href.length > 1 ? { type: 'anchor', frag: safeDecode(href.slice(1)) } : null;
  let u;
  try { u = new URL(href, `https://${lang}.wikipedia.org/wiki/`); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;

  const m = WIKI_HOST.exec(u.hostname);
  if (m && validLang(m[1].toLowerCase())) {
    const l = m[1].toLowerCase();
    let title = null;
    if (u.pathname.startsWith('/wiki/')) title = safeDecode(u.pathname.slice(6));
    else if (u.pathname === '/w/index.php') {
      const q = u.searchParams;
      if (q.get('redlink')) return { type: 'red' };
      if (q.get('title') && !q.get('action') && !q.get('diff') && !q.get('oldid')) title = q.get('title');
    }
    if (title) {
      title = title.replace(/_/g, ' ');
      if (/^(special|media):/i.test(title)) {
        if (/^special:search$/i.test(title) && u.searchParams.get('search')) return { type: 'search', lang: l, query: u.searchParams.get('search') };
        return { type: 'ext', url: u.href };
      }
      return { type: 'wiki', lang: l, title, frag: u.hash ? safeDecode(u.hash.slice(1)) : '' };
    }
  }
  u.protocol = u.protocol === 'http:' ? 'http:' : 'https:';
  return { type: 'ext', url: u.href };
}
function safeDecode(s) { try { return decodeURIComponent(s); } catch { return s; } }

// ---------- Inline styles ----------
const LEN = /^-?(\d{1,4}|\d{0,4}\.\d{1,4})(px|em|rem|%|ex|ch|pt)?$/i;
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.\s,%/]+\)|hsla?\(\s*[\d.\s,%deg/]+\)|[a-z]{3,20})$/i;
const BORDER_STYLE = /^(none|solid|dashed|dotted|double|groove|ridge|inset|outset|hidden)$/i;
const words = (v) => v.trim().split(/\s+(?![^(]*\))/);   // split on spaces, not inside ( )
const all = (v, test) => { const w = words(v); return w.length > 0 && w.length <= 4 && w.every(test); };
const lenOrAuto = (t) => t === 'auto' || LEN.test(t);
const border = (v) => all(v, (t) => LEN.test(t) || BORDER_STYLE.test(t) || COLOR.test(t));
const oneOf = (...a) => (v) => a.includes(v.toLowerCase());

const STYLE_RULES = {
  'text-align': oneOf('left', 'right', 'center', 'justify'),
  'vertical-align': oneOf('top', 'middle', 'bottom', 'baseline', 'sub', 'super', 'text-top', 'text-bottom'),
  width: (v) => lenOrAuto(v) || v === 'fit-content', 'min-width': lenOrAuto, 'max-width': lenOrAuto, height: lenOrAuto, 'min-height': lenOrAuto,
  float: oneOf('left', 'right', 'none'), clear: oneOf('left', 'right', 'both', 'none'),
  'font-size': (v) => LEN.test(v) || /^(x{1,2}-)?(small|large)(r)?$|^medium$/i.test(v),
  'font-weight': (v) => /^(bold|normal|bolder|lighter|[1-9]00)$/i.test(v),
  'font-style': oneOf('italic', 'normal', 'oblique'),
  'font-variant': oneOf('small-caps', 'normal'),
  'text-decoration': oneOf('underline', 'line-through', 'none', 'overline'),
  'text-transform': oneOf('uppercase', 'lowercase', 'capitalize', 'none'),
  'white-space': oneOf('nowrap', 'normal', 'pre', 'pre-wrap', 'pre-line'),
  'line-height': (v) => LEN.test(v) || v === 'normal',
  'column-count': (v) => /^\d{1,2}$/.test(v), 'column-width': LEN, columns: (v) => all(v, (t) => LEN.test(t) || /^\d{1,2}$/.test(t)),
  margin: (v) => all(v, lenOrAuto), 'margin-top': lenOrAuto, 'margin-bottom': lenOrAuto, 'margin-left': lenOrAuto, 'margin-right': lenOrAuto,
  padding: (v) => all(v, LEN.test.bind(LEN)), 'padding-top': LEN, 'padding-bottom': LEN, 'padding-left': LEN, 'padding-right': LEN,
  color: (v) => COLOR.test(v), 'background-color': (v) => COLOR.test(v), background: (v) => COLOR.test(v),
  border, 'border-top': border, 'border-bottom': border, 'border-left': border, 'border-right': border,
  'border-collapse': oneOf('collapse', 'separate'), 'border-spacing': (v) => all(v, (t) => LEN.test(t)),
  'list-style-type': oneOf('disc', 'circle', 'square', 'decimal', 'none', 'lower-alpha', 'upper-alpha', 'lower-roman', 'upper-roman', 'lower-greek'),
  display: oneOf('block', 'inline', 'inline-block', 'table', 'table-cell')
};

/** Returns a cleaned style string, or null when the element is meant to be hidden. */
function cleanStyle(raw) {
  const out = [];
  for (const decl of raw.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim().toLowerCase();
    const val = decl.slice(i + 1).replace(/!important/i, '').trim();
    if (!val) continue;
    if ((prop === 'display' && /^none$/i.test(val)) || (prop === 'visibility' && /^hidden$/i.test(val))) return null;
    const ok = Object.hasOwn(STYLE_RULES, prop) ? STYLE_RULES[prop] : null;
    if (ok && !/[\\@]|url\s*\(|expression|var\s*\(/i.test(val) && ok(val)) out.push(`${prop}:${val}`);
  }
  return out.join(';');
}

// ---------- Rebuild ----------
const SAFE_DIR = new Set(['ltr', 'rtl', 'auto']);
const NO_WRAP_TABLE = /\b(infobox|sidebar|floatright|floatleft|tright|tleft|mbox|ambox|navbox-inner)\b/;

function copyAttrs(src, el, tag, ctx) {
  const set = (k, v) => { if (v != null && v !== '') el.setAttribute(k, v); };
  let style = null, hide = false;

  for (const { name, value } of src.attributes) {
    switch (name) {
      case 'class': set('class', value.split(/\s+/).filter(Boolean).map((c) => 'wpc-' + c.replace(/[^\w-]/g, '_')).join(' ')); break;
      case 'id': set('id', 'wp-' + value); break;
      case 'lang': if (/^[a-z]{2,12}(-[\w]+)*$/i.test(value)) set('lang', value); break;
      case 'dir': if (SAFE_DIR.has(value)) set('dir', value); break;
      case 'title': set('title', value.slice(0, 500)); break;
      case 'style': { const s = cleanStyle(value); if (s === null) hide = true; else style = s; break; }
      case 'hidden': hide = true; break;
      case 'colspan': case 'rowspan': if (/^\d{1,3}$/.test(value)) set(name, value); break;
      case 'scope': if (/^(row|col|rowgroup|colgroup)$/.test(value)) set(name, value); break;
      case 'width': case 'height':
        if (/^(img|table|td|th|col|video)$/.test(tag) && /^\d{1,4}%?$/.test(value)) set(name, value); break;
      case 'align': if (/^(left|right|center|justify)$/i.test(value)) style = (style || '') + `;text-align:${value.toLowerCase()}`; break;
      case 'valign': if (/^(top|middle|bottom|baseline)$/i.test(value)) style = (style || '') + `;vertical-align:${value.toLowerCase()}`; break;
      case 'bgcolor': if (COLOR.test(value)) style = (style || '') + `;background-color:${value}`; break;
      case 'start': if (tag === 'ol' && /^-?\d{1,6}$/.test(value)) set('start', value); break;
      case 'reversed': if (tag === 'ol') set('reversed', ''); break;
      case 'type': if (tag === 'ol' && /^[1aAiI]$/.test(value)) set('type', value); if (tag === 'source' && /^(audio|video)\/[\w.+-]+$/.test(value)) set('type', value); break;
      case 'datetime': if (tag === 'time') set('datetime', value.slice(0, 40)); break;
      case 'open': if (tag === 'details') set('open', ''); break;
      case 'alt': if (tag === 'img') set('alt', value.slice(0, 1000)); break;
      default: break; // everything else (on*, data-*, srcdoc, formaction, name, …) is dropped
    }
  }
  if (style) el.setAttribute('style', style.replace(/^;/, ''));
  return !hide;
}

/** One malformed element must never take the whole article down: skip it and carry on. */
function build(src, ctx) {
  try { return buildNode(src, ctx); } catch (err) { ctx.skipped = (ctx.skipped || 0) + 1; console.warn('wikihtml: skipped an element', src.localName, err); return null; }
}

function buildNode(src, ctx) {
  if (src.nodeType === 3) return document.createTextNode(src.data);
  if (src.nodeType !== 1) return null;
  const tag = src.localName;
  if (DROP.has(tag)) return null;
  for (const c of src.classList) if (DROP_CLASS.has(c)) return null;

  const children = (into) => { for (const c of src.childNodes) { const n = build(c, ctx); if (n) into.append(n); } return into; };
  if (!ALLOWED.has(tag)) return children(document.createDocumentFragment()); // unknown tag: keep its text, lose the wrapper

  if (src.hasAttribute('hidden')) return null;
  const el = document.createElement(tag);
  if (!copyAttrs(src, el, tag, ctx)) return null;

  if (tag === 'table') ctx.tables++;
  try { children(el); } finally { if (tag === 'table') ctx.tables--; }

  switch (tag) {
    case 'a': {
      const link = resolveLink(src.getAttribute('href'), ctx.lang);
      if (!link) break;
      el.setAttribute('href', '#');
      if (link.type === 'wiki') {
        el.dataset.wpLang = link.lang; el.dataset.wpTitle = link.title;
        if (link.frag) el.dataset.wpFrag = link.frag;
      } else if (link.type === 'search') { el.dataset.wpLang = link.lang; el.dataset.wpQuery = link.query; }
      else if (link.type === 'anchor') el.dataset.wpAnchor = 'wp-' + link.frag;
      else if (link.type === 'red') { el.removeAttribute('href'); el.classList.add('wpc-new'); el.title = (el.title || '') + ' (page does not exist)'; }
      else {
        el.setAttribute('href', link.url);
        el.target = '_blank';
        el.rel = 'noopener noreferrer nofollow';
        el.classList.add('wpc-ext-link');
      }
      break;
    }
    case 'img': {
      const s = mediaUrl(src.getAttribute('src'), ctx.lang);
      if (!s) return null;
      el.src = s;
      const set = src.getAttribute('srcset');
      if (set) {
        const parts = set.split(',').map((p) => p.trim().split(/\s+/)).map(([u, d]) => [mediaUrl(u, ctx.lang), d]).filter(([u]) => u);
        if (parts.length) el.srcset = parts.map(([u, d]) => (d ? `${u} ${d}` : u)).join(', ');
      }
      el.loading = 'lazy'; el.decoding = 'async'; el.referrerPolicy = 'no-referrer';
      break;
    }
    case 'video': case 'audio': {
      const s = mediaUrl(src.getAttribute('src'), ctx.lang);
      if (s) el.src = s;
      if (tag === 'video') { const p = mediaUrl(src.getAttribute('poster'), ctx.lang); if (p) el.poster = p; }
      el.controls = true; el.preload = 'none';
      el.setAttribute('playsinline', '');
      break;
    }
    case 'source': {
      const s = mediaUrl(src.getAttribute('src'), ctx.lang);
      if (!s) return null;
      el.src = s;
      break;
    }
    case 'table': {
      if (ctx.tables === 0 && !NO_WRAP_TABLE.test(src.className)) {   // top-level data tables scroll instead of overflowing
        const wrap = document.createElement('div');
        wrap.className = 'wpc-tablewrap';
        wrap.append(el);
        return wrap;
      }
      break;
    }
    default: break;
  }
  return el;
}

/** Sanitise Wikipedia article HTML. Returns a <div class="wp-article"> ready to insert. */
export function sanitizeArticle(html, lang) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const root = document.createElement('div');
  root.className = 'wp-article';
  const ctx = { lang, tables: 0 };
  for (const n of doc.body.childNodes) { const c = build(n, ctx); if (c) root.append(c); }
  return root;
}

/** Inline-only variant (titles, descriptions, news blurbs): returns a DocumentFragment. */
export function sanitizeInline(html, lang) {
  const root = sanitizeArticle(html, lang);
  const frag = document.createDocumentFragment();
  frag.append(...root.childNodes);
  return frag;
}

/** Search snippets: plain text, with matched terms in <mark>. */
export function snippetFragment(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const frag = document.createDocumentFragment();
  const walk = (n, into) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) into.append(document.createTextNode(c.data));
      else if (c.nodeType === 1) {
        if (/^(script|style)$/i.test(c.localName)) continue;
        if (c.classList.contains('searchmatch')) { const m = document.createElement('mark'); m.textContent = c.textContent; into.append(m); }
        else walk(c, into);
      }
    }
  };
  walk(doc.body, frag);
  return frag;
}
