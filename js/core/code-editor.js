/* ============================================================
   Shared Code Editor for IDEs.
   Uses a transparent <textarea> overlaid on a highlighted <pre>.
   Handles line numbers, scrolling sync, and basic tokenization.
   ============================================================ */

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// --- Tokenizers ---

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
      // Color the whole tag block, italicize attributes
      const match = tagStr.match(/^<([a-zA-Z0-9\-]+)|^<\/?([a-zA-Z0-9\-]+)/);
      const tagName = match ? (match[1] || match[2]) : '';
      let inner = tagStr;
      if (tagName) {
         // Basic attribute highlighting
         inner = tagStr.replace(/([a-zA-Z\-]+)=/g, '<span class="tok-attr">$1</span>=');
      }
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
    } else if (code[i] === '{') {
      result += esc(code[i]);
      i++;
    } else if (code[i] === '}') {
      result += esc(code[i]);
      i++;
    } else if (/[a-zA-Z\-]/.test(code[i])) {
      let end = i + 1;
      while (end < code.length && /[a-zA-Z0-9\-]/.test(code[end])) end++;
      const word = code.slice(i, end);
      // If it's followed by a colon, it's a property
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

// --- The Editor Class ---

export class CodeEditor {
  constructor(container, options = {}) {
    this.container = container;
    this.language = options.language || 'text';
    this.onChange = options.onChange || (() => {});
    
    this.container.innerHTML = `
      <div class="code-editor-wrap">
        <div class="code-gutter"></div>
        <div class="code-area">
          <pre class="code-highlight"><code></code></pre>
          <textarea class="code-input" spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
        </div>
      </div>
    `;

    this.gutter = this.container.querySelector('.code-gutter');
    this.highlight = this.container.querySelector('.code-highlight code');
    this.input = this.container.querySelector('.code-input');

    this.input.addEventListener('input', () => this.update());
    this.input.addEventListener('scroll', () => this.syncScroll());
    
    // Handle Tab key
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = this.input.selectionStart;
        const end = this.input.selectionEnd;
        this.input.value = this.input.value.substring(0, start) + '    ' + this.input.value.substring(end);
        this.input.selectionStart = this.input.selectionEnd = start + 4;
        this.update();
      }
    });

    if (options.value) this.setValue(options.value);
    else this.update();
  }

  update() {
    const val = this.input.value;
    
    // 1. Highlight Code
    if (this.language === 'python') this.highlight.innerHTML = tokenizePython(val) + '\n';
    else if (this.language === 'html') this.highlight.innerHTML = tokenizeHTML(val) + '\n';
    else if (this.language === 'js') this.highlight.innerHTML = tokenizeJS(val) + '\n';
    else if (this.language === 'css') this.highlight.innerHTML = tokenizeCSS(val) + '\n';
    else this.highlight.textContent = val + '\n';

    // 2. Update Line Numbers
    const lines = val.split('\n').length;
    if (this.gutter.dataset.lines != lines) {
      this.gutter.dataset.lines = lines;
      let numHtml = '';
      for (let i = 1; i <= lines; i++) numHtml += i + '<br>';
      this.gutter.innerHTML = numHtml;
    }

    // 3. Sync Scroll
    this.syncScroll();
    this.onChange(val);
  }

  syncScroll() {
    this.gutter.scrollTop = this.input.scrollTop;
    this.highlight.parentElement.scrollTop = this.input.scrollTop;
    this.highlight.parentElement.scrollLeft = this.input.scrollLeft;
  }

  getValue() {
    return this.input.value;
  }

  setValue(val) {
    this.input.value = val;
    this.update();
  }

  focus() {
    this.input.focus();
  }
}
