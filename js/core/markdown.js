/* Tiny, safe Markdown renderer for chat output.
   Everything is HTML-escaped FIRST; only the tags generated here ever reach the DOM.
   Handles: fenced code (also unterminated, for streaming), inline code, bold, italic, links (http/https only),
   headings, lists, blockquotes, rules, and <think>…</think> reasoning blocks (collapsible). */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

function inline(raw) {
  return raw.split(/(`[^`\n]+`)/).map((part, i) => {
    if (i % 2) return `<code>${esc(part.slice(1, -1))}</code>`;
    let s = esc(part);
    s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*\w])\*([^*\n]+?)\*(?!\w)/g, '$1<em>$2</em>');
    return s;
  }).join('');
}

function textBlock(text) {
  const out = [];
  let para = [];
  let list = null;                  // { tag, items }
  let quote = [];
  const flushPara = () => { if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; };
  const flushList = () => { if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`); list = null; };
  const flushQuote = () => { if (quote.length) out.push(`<blockquote>${quote.map(inline).join('<br>')}</blockquote>`); quote = []; };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };

  for (const line of text.split('\n')) {
    let m;
    if (!line.trim()) { flushAll(); continue; }
    if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) { flushAll(); const n = Math.min(m[1].length + 1, 6); out.push(`<h${n}>${inline(m[2])}</h${n}>`); continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flushAll(); out.push('<hr>'); continue; }
    if ((m = /^\s*>\s?(.*)$/.exec(line))) { flushPara(); flushList(); quote.push(m[1]); continue; }
    if ((m = /^\s*[-*+]\s+(.*)$/.exec(line))) { flushPara(); flushQuote(); if (list?.tag !== 'ul') { flushList(); list = { tag: 'ul', items: [] }; } list.items.push(m[1]); continue; }
    if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(line))) { flushPara(); flushQuote(); if (list?.tag !== 'ol') { flushList(); list = { tag: 'ol', items: [] }; } list.items.push(m[1]); continue; }
    flushList(); flushQuote();
    para.push(line);
  }
  flushAll();
  return out.join('');
}

function block(src) {
  let out = '';
  let last = 0;
  const fence = /```([\w+#.-]*)[^\S\n]*\n?([\s\S]*?)(```|$)/g;   // `$` lets an unfinished fence render while streaming
  let m;
  while ((m = fence.exec(src)) !== null) {
    out += textBlock(src.slice(last, m.index));
    const lang = esc(m[1]);
    out += `<div class="ai-code"><div class="ai-code-head"><span>${lang || 'code'}</span><button type="button" data-copy>Copy</button></div><pre><code>${esc(m[2].replace(/\n$/, ''))}</code></pre></div>`;
    last = m.index + m[0].length;
    if (m[0].length === 0) fence.lastIndex++;
  }
  return out + textBlock(src.slice(last));
}

export function renderMarkdown(src) {
  let rest = String(src ?? '');
  let out = '';
  for (;;) {
    const i = rest.indexOf('<think>');
    if (i < 0) return out + block(rest);
    out += block(rest.slice(0, i));
    const j = rest.indexOf('</think>', i);
    const inner = rest.slice(i + 7, j < 0 ? undefined : j);
    out += `<details class="ai-think"${j < 0 ? ' open' : ''}><summary>${j < 0 ? 'Thinking…' : 'Thought process'}</summary>${block(inner)}</details>`;
    if (j < 0) return out;
    rest = rest.slice(j + 8);
  }
}
