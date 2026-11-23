/* ============================================================
   Shared Code Editor for IDEs.
   Uses a transparent <textarea> overlaid on a highlighted <pre>.

   Three editing modes, chosen automatically from the initial size:

     full   (≤ 500 KB)     — highlighting + static gutter (as before)
     plain  (500 KB–10 MB) — textarea only + virtualized gutter
                             (only ~40 line numbers in the DOM at once)
     raw    (10 MB–50 MB)  — textarea only, no highlighting, no gutter
     refuse (> 50 MB)      — throws EditorTooLargeError

   Callers should catch EditorTooLargeError and show it to the user
   instead of letting it propagate (it would otherwise kill the whole
   app's launch promise).
   ============================================================ */

const FULL_MAX  = 500 * 1024;
const PLAIN_MAX = 10 * 1024 * 1024;
const RAW_MAX   = 50 * 1024 * 1024;

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return parseFloat((bytes / 1024 ** i).toFixed(1)) + ' ' + units[i];
}

function autoMode(len) {
  if (len <= FULL_MAX) return 'full';
  if (len <= PLAIN_MAX) return 'plain';
  if (len <= RAW_MAX) return 'raw';
  return 'refuse';
}

/** Cheap line counter — no array allocation. */
function countLines(text) {
  let n = 1;
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) n++;
  return n;
}

export class EditorTooLargeError extends Error {
  constructor(size, max) {
    super(`File is ${formatBytes(size)} — the editor can open up to ${formatBytes(max)}.`);
    this.name = 'EditorTooLargeError';
    this.size = size;
    this.max = max;
  }
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// --- Tokenizers (used only in full mode) ---

function tokenizePython(code) {
  let result = '';
  let i = 0;
  const keywords = /^(def|class|return|if|else|elif|for|while|in|import|from|as|try|except|finally|with|lambda|pass|break|continue|and|or|not|is|None|True|False|global|nonlocal|yield|assert|del|raise)\b/;

  while (i < code.length) {
    if (code[i] === '#') {
      let end = code.indexOf('\n', i);
      if (end === -1) end = code.length;
      result += `<span class="tok-com">${esc(code.slice(i, end))}</span>`;
      i = end;
    } else if (code[i] === '"' || code[i] === "'") {
      const quote = code[i];
      let end = i + 1;
      while (end < code.length && code[end] !== quote) {
        if (code[end] === '\\') end++;
        end++;
      }
      if (end < code.length) end++;
      result += `<span class="tok-str">${esc(code.slice(i, end))}</span>`;
      i = end;
    } else if (/[a-zA-Z_]/.test(code[i])) {
      let end = i + 1;
      while (end < code.length && /[a-zA-Z0-9_]/.test(code[end])) end++;
      const word = code.slice(i, end);
      if (keywords.test(word)) {
        result += `<span class="tok-kw">${esc(word)}</span>`;
      } else if (code[end] === '(') {
        result += `<span class="tok-fn">${esc(word)}</span>`;
      } else {
        result += esc(word);
      }
      i = end;
    } else if (/\d/.test(code[i])) {
      let end = i + 1;
      while (end < code.length && /[0-9.]/.test(code[end])) end++;
      result += `<span class="tok-num">${esc(code.slice(i, end))}</span>`;
      i = end;
    } else {
      result += esc(code[i]);
      i++;
    }
  }
  return result;
}

function tokenizeHTML(code) {
  let result = '';
  let i = 0;
  while (i < code.length) {
    if (code.slice(i, i + 4) === '<!--') {
      let end = code.indexOf('-->', i);
      if (end === -1) end = code.length;
      else end += 3;
      result += `<span class="tok-com">${esc(code.slice(i, end))}</span>`;
      i = end;
    } else if (code[i] === '<') {
      let end = code.indexOf('>', i);
      if (end === -1) {
        result += esc(code.slice(i));
        break;
      }
      end++;
      const tagStr = code.slice(i, end);
      let inner = esc(tagStr);
      inner = inner.replace(/([a-zA-Z\-]+)=/g, '<span class="tok-attr">$1</span>=');
      result += `<span class="tok-tag">${inner}</span>`;
      i = end;
    } else {
      result += esc(code[i]);
      i++;
    }
  }
  return result;
}

function tokenizeJS(code) {
  let result = '';
  let i = 0;
  const keywords = /^(const|let|var|function|return|if|else|for|while|class|import|export|default|async|await|new|this|true|false|null|undefined|typeof|instanceof|try|catch|finally|switch|case|break|continue|delete|in|of)\b/;

  while (i < code.length) {
    if (code.slice(i, i + 2) === '//') {
      let end = code.indexOf('\n', i);
      if (end === -1) end = code.length;
      result += `<span class="tok-com">${esc(code.slice(i, end))}</span>`;
      i = end;
    } else if (code.slice(i, i + 2) === '/*') {
      let end = code.indexOf('*/', i);
      if (end === -1) end = code.length;
      else end += 2;
      result += `<span class="tok-com">${esc(code.slice(i, end))}</span>`;
      i = end;
    } else if (code[i] === '"' || code[i] === "'" || code[i] === '`') {
      const quote = code[i];
      let end = i + 1;
      while (end < code.length && code[end] !== quote) {
        if (code[end] === '\\') end++;
        end++;
      }
      if (end < code.length) end++;
      result += `<span class="tok-str">${esc(code.slice(i, end))}</span>`;
      i = end;
    } else if (/[a-zA-Z_$]/.test(code[i])) {
      let end = i + 1;
      while (end < code.length && /[a-zA-Z0-9_$]/.test(code[end])) end++;
      const word = code.slice(i, end);
      if (keywords.test(word)) {
        result += `<span class="tok-kw">${esc(word)}</span>`;
      } else if (code[end] === '(') {
        result += `<span class="tok-fn">${esc(word)}</span>`;
      } else {
        result += esc(word);
      }
      i = end;
    } else if (/\d/.test(code[i])) {
      let end = i + 1;
      while (end < code.length && /[0-9.]/.test(code[end])) end++;
      result += `<span class="tok-num">${esc(code.slice(i, end))}</span>`;
      i = end;
    } else {
      result += esc(code[i]);
      i++;
    }
  }
  return result;
}

function tokenizeCSS(code) {
  let result = '';
  let i = 0;
  while (i < code.length) {
    if (code.slice(i, i + 2) === '/*') {
      let end = code.indexOf('*/', i);
      if (end === -1) end = code.length;
      else end += 2;
      result += `<span class="tok-com">${esc(code.slice(i, end))}</span>`;
      i = end;
    } else if (code[i] === '{' || code[i] === '}') {
      result += esc(code[i]);
      i++;
    } else if (/[a-zA-Z\-]/.test(code[i])) {
      let end = i + 1;
      while (end < code.length && /[a-zA-Z0-9\-]/.test(code[end])) end++;
      const word = code.slice(i, end);
      let look = end;
      while (look < code.length && /\s/.test(code[look])) look++;
      if (code[look] === ':') {
        result += `<span class="tok-kw">${esc(word)}</span>`;
      } else {
        result += esc(word);
      }
      i = end;
    } else if (/\d/.test(code[i])) {
      let end = i + 1;
      while (end < code.length && /[0-9a-zA-Z%\.]/.test(code[end])) end++;
      result += `<span class="tok-num">${esc(code.slice(i, end))}</span>`;
      i = end;
    } else {
      result += esc(code[i]);
      i++;
    }
  }
  return result;
}

const TOKENIZERS = {
  python: tokenizePython,
  html: tokenizeHTML,
  js: tokenizeJS,
  css: tokenizeCSS
};

// --- The Editor Class ---

export class CodeEditor {
  constructor(container, options = {}) {
    this.container = container;
    this.language = options.language || 'text';
    this.onChange = options.onChange || (() => {});

    const initial = options.value || '';
    this.mode = options.mode || autoMode(initial.length);
    if (this.mode === 'refuse') {
      throw new EditorTooLargeError(initial.length, RAW_MAX);
    }

    this.totalLines = this.mode === 'full' ? 0 : countLines(initial);
    this._recountTimer = 0;
    this._pendingValue = initial;

    if (this.mode === 'full') {
      this.container.innerHTML = `
        <div class="code-editor-wrap">
          <div class="code-gutter"></div>
          <div class="code-area">
            <pre class="code-highlight"><code></code></pre>
            <textarea class="code-input" spellcheck="false" autocomplete="off" autocapitalize="off" wrap="off"></textarea>
          </div>
        </div>
      `;
      this.gutter = this.container.querySelector('.code-gutter');
      this.highlight = this.container.querySelector('.code-highlight code');
    } else if (this.mode === 'plain') {
      this.container.innerHTML = `
        <div class="code-editor-wrap code-editor-plain">
          <div class="code-gutter code-gutter-virtual"></div>
          <div class="code-area">
            <textarea class="code-input" spellcheck="false" autocomplete="off" autocapitalize="off" wrap="off"></textarea>
          </div>
        </div>
      `;
      this.gutter = this.container.querySelector('.code-gutter');
      this.highlight = null;
    } else { // raw
      this.container.innerHTML = `
        <div class="code-editor-wrap code-editor-raw">
          <div class="code-area">
            <textarea class="code-input" spellcheck="false" autocomplete="off" autocapitalize="off" wrap="off"></textarea>
          </div>
        </div>
      `;
      this.gutter = null;
      this.highlight = null;
    }

    this.input = this.container.querySelector('.code-input');

    this.input.addEventListener('input', () => this.update());
    this.input.addEventListener('scroll', () => this.syncScroll());
    this.input.addEventListener('keydown', (e) => this._onKeyDown(e));

    if (this.mode === 'full') {
      this.setValue(initial);
    } else {
      // For plain/raw, defer the giant string assignment so the DOM paints
      // first (empty area visible for one frame, then text appears).
      this.input.value = '';
      requestAnimationFrame(() => {
        this.input.value = initial;
        this._pendingValue = '';
        this.syncScroll();
        if (this.mode === 'plain') this._updateVirtualGutter();
        // Fire onChange once so the app knows the file is loaded.
        this.onChange(this.input.value);
      });
    }
  }

  update() {
    const val = this.input.value;

    if (this.mode === 'full') {
      const tok = TOKENIZERS[this.language];
      if (tok) this.highlight.innerHTML = tok(val) + '\n';
      else this.highlight.textContent = val + '\n';

      const lines = countLines(val);
      if (this.gutter.dataset.lines != lines) {
        this.gutter.dataset.lines = lines;
        let numHtml = '';
        for (let i = 1; i <= lines; i++) numHtml += i + '<br>';
        this.gutter.innerHTML = numHtml;
      }
    } else if (this.mode === 'plain') {
      // Do not recount on every keystroke — debounce and let the gutter be
      // slightly stale for a moment. This is what keeps 10 MB files fluid.
      clearTimeout(this._recountTimer);
      this._recountTimer = setTimeout(() => {
        this.totalLines = countLines(this.input.value);
        this._updateVirtualGutter();
      }, 400);
    } else {
      // raw mode — no gutter to update, but keep totalLines for any caller
      // that reads it (status bar).
      clearTimeout(this._recountTimer);
      this._recountTimer = setTimeout(() => {
        this.totalLines = countLines(this.input.value);
      }, 400);
    }

    this.syncScroll();
    this.onChange(val);
  }

  syncScroll() {
    if (this.mode === 'full' && this.gutter) {
      this.gutter.scrollTop = this.input.scrollTop;
    }
    if (this.highlight?.parentElement) {
      this.highlight.parentElement.scrollTop = this.input.scrollTop;
      this.highlight.parentElement.scrollLeft = this.input.scrollLeft;
    }
    if (this.mode === 'plain') this._updateVirtualGutter();
  }

  /** Reposition ~40 line numbers in the gutter based on the current scroll. */
  _updateVirtualGutter() {
    if (this.mode !== 'plain' || !this.gutter) return;
    const style = getComputedStyle(this.input);
    const lineHeight = parseFloat(style.lineHeight) || 20;
    const paddingTop = parseFloat(style.paddingTop) || 10;
    const scrollTop = this.input.scrollTop;
    const viewportH = this.input.clientHeight;

    const first = Math.max(1, Math.floor((scrollTop - paddingTop) / lineHeight) + 1);
    const last = Math.min(this.totalLines, Math.ceil((scrollTop + viewportH - paddingTop) / lineHeight) + 1);

    // If the visible range hasn't changed, do nothing (avoids layout churn).
    const key = first + ':' + last;
    if (this.gutter.dataset.range === key) return;
    this.gutter.dataset.range = key;

    const frag = document.createDocumentFragment();
    for (let n = first; n <= last; n++) {
      const el = document.createElement('div');
      el.textContent = n;
      el.style.position = 'absolute';
      el.style.right = '8px';
      el.style.top = (paddingTop + (n - 1) * lineHeight - scrollTop) + 'px';
      frag.appendChild(el);
    }
    this.gutter.replaceChildren(frag);
  }

  _onKeyDown(e) {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    // execCommand preserves the undo stack and — crucially — doesn't allocate
    // a fresh copy of the entire string the way substring-concat would.
    if (!document.execCommand('insertText', false, '    ')) {
      const start = this.input.selectionStart;
      const end = this.input.selectionEnd;
      this.input.value = this.input.value.substring(0, start) + '    ' + this.input.value.substring(end);
      this.input.selectionStart = this.input.selectionEnd = start + 4;
      this.update();
    }
  }

  getValue() {
    if (this._pendingValue) return this._pendingValue;
    return this.input.value;
  }

  setValue(val) {
    if (this.mode === 'full') {
      this.input.value = val;
      this.update();
    } else {
      this.input.value = val;
      this.totalLines = countLines(val);
      this.syncScroll();
      if (this.mode === 'plain') this._updateVirtualGutter();
      this.onChange(val);
    }
  }

  focus() {
    this.input.focus();
  }

  destroy() {
    clearTimeout(this._recountTimer);
  }
}
