import { evaluate, formatNumber, formatRaw } from './calculator-engine.js';
import { iconHTML } from '../core/icons.js';
import { esc } from '../core/util.js';

const HISTORY_KEY = 'os16.calc.history';
const HISTORY_MAX = 50;

// [label, style, action, tooltip]
const KEYS = [
  ['C', 'fn', 'clear', 'Clear (Esc)'], ['⌫', 'fn', 'back', 'Backspace'], ['(', 'fn', '('], [')', 'fn', ')'],
  ['%', 'fn', '%'], ['√', 'fn', '√', 'Square root'], ['x²', 'fn', 'square', 'Square'], ['÷', 'op', '÷'],
  ['7', '', '7'], ['8', '', '8'], ['9', '', '9'], ['×', 'op', '×'],
  ['4', '', '4'], ['5', '', '5'], ['6', '', '6'], ['−', 'op', '−'],
  ['1', '', '1'], ['2', '', '2'], ['3', '', '3'], ['+', 'op', '+'],
  ['±', 'fn', 'negate', 'Toggle sign'], ['0', '', '0'], ['.', '', '.'], ['=', 'eq', 'equals', 'Equals (Enter)']
];

const KEY_MAP = { '*': '×', '/': '÷', '-': '−', '+': '+', '^': '^', '(': '(', ')': ')', '%': '%', '.': '.', ',': '.' };

const OPERATORS = '+−×÷^';
const isOperand = (ch) => /[\d)%π]/.test(ch);

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; }
}
function saveHistory(h) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch { /* storage unavailable */ }
}

export const calculatorApp = {
  id: 'calculator',
  name: 'Calculator',
  icon: 'calc',
  defaultSize: [320, 500],
  singleton: true,

  launch(body, args, ctx) {
    let expr = '';
    let fresh = false;     // expr currently holds a committed result
    let lastExpr = '';     // expression that produced it (shown above)
    let error = '';
    let history = loadHistory();

    body.innerHTML = `
      <div class="calc" tabindex="0">
        <div class="app-toolbar">
          <button class="toolbar-btn btn-history" aria-pressed="false" title="History">${iconHTML('list', 14)} History</button>
        </div>
        <div class="calc-display" aria-live="polite">
          <div class="calc-preview"></div>
          <div class="calc-expr">0</div>
        </div>
        <div class="calc-keys">
          ${KEYS.map(([label, style, act, tip]) =>
            `<button type="button" class="calc-key ${style}" data-act="${esc(act)}" title="${esc(tip || label)}">${esc(label)}</button>`).join('')}
        </div>
        <div class="calc-history" hidden>
          <div class="calc-history-head">
            <span>History</span>
            <button type="button" class="app-btn btn-clear-history">Clear</button>
          </div>
          <div class="calc-history-list"></div>
        </div>
      </div>`;

    const $ = (s) => body.querySelector(s);
    const root = $('.calc');
    const elPreview = $('.calc-preview');
    const elExpr = $('.calc-expr');
    const elHistory = $('.calc-history');
    const elHistoryList = $('.calc-history-list');
    const btnHistory = $('.btn-history');

    // ---------- Display ----------
    function render() {
      elExpr.textContent = expr || '0';
      elExpr.dataset.size = expr.length > 22 ? 'xs' : expr.length > 12 ? 's' : 'm';
      elExpr.scrollLeft = elExpr.scrollWidth;

      elPreview.classList.toggle('is-error', !!error);
      if (error) {
        elPreview.textContent = error;
      } else if (fresh) {
        elPreview.textContent = lastExpr ? `${lastExpr} =` : '';
      } else {
        const r = evaluate(expr);
        // Only preview when the expression is more than a bare number (which may be negative).
        const worthPreview = r.ok && r.value !== null && /[^\d.\-−]/.test(expr);
        elPreview.textContent = worthPreview ? '= ' + formatNumber(r.value) : '';
      }
    }

    // ---------- Editing ----------
    const last = () => expr.slice(-1);

    function startNew() {
      if (fresh) { expr = ''; lastExpr = ''; fresh = false; }
    }

    function negate() {
      const m = /(\d+\.?\d*|\.\d+)$/.exec(expr);
      if (!m) {
        if (!expr || /[(×÷^]$/.test(expr)) expr += '−';
        return;
      }
      const i = m.index;
      const before = expr[i - 1];
      const isUnaryMinus = before === '−' && (i === 1 || /[+(−×÷^]/.test(expr[i - 2]));
      if (isUnaryMinus) expr = expr.slice(0, i - 1) + expr.slice(i);   // −5 → 5
      else if (before === '−') expr = expr.slice(0, i - 1) + '+' + expr.slice(i); // 5−3 → 5+3
      else if (before === '+') expr = expr.slice(0, i - 1) + '−' + expr.slice(i); // 5+3 → 5−3
      else if (before === undefined || /[(×÷^]/.test(before)) expr = expr.slice(0, i) + '−' + expr.slice(i); // 5 → −5
    }

    function press(act) {
      error = '';
      if (/^\d$/.test(act)) {
        startNew();
        if (/(^|[^\d.])0$/.test(expr)) expr = expr.slice(0, -1); // no leading zeros
        else if (/[)%π]$/.test(expr)) expr += '×';
        expr += act;
      } else if (act === '.') {
        startNew();
        const num = /[\d.]*$/.exec(expr)[0];
        if (num.includes('.')) return;
        if (!num) expr += /[)%π]$/.test(expr) ? '×0.' : '0.';
        else expr += '.';
      } else if (OPERATORS.includes(act)) {
        fresh = false;
        if (!expr) { if (act === '−') expr = '−'; return; }
        const l = last();
        if (l === '(') { if (act === '−') expr += '−'; return; }
        if (act === '−' && '×÷^'.includes(l)) { expr += '−'; return; } // 2×−3
        if (OPERATORS.includes(l)) {
          expr = expr.replace(/[+−×÷^]+$/, '');
          if (!expr) { if (act === '−') expr = '−'; return; }
        }
        expr += act;
      } else {
        switch (act) {
          case '(':
          case '√':
            startNew();
            if (expr && isOperand(last())) expr += '×';
            expr += act;
            break;
          case ')': {
            const open = (expr.match(/\(/g) || []).length - (expr.match(/\)/g) || []).length;
            if (open > 0 && isOperand(last())) expr += ')';
            break;
          }
          case '%': if (isOperand(last()) && last() !== 'π') { fresh = false; expr += '%'; } break;
          case 'square': if (isOperand(last())) { fresh = false; expr += '^2'; } break;
          case 'negate': negate(); break;
          case 'back': fresh = false; lastExpr = ''; expr = expr.slice(0, -1); break;
          case 'clear': expr = ''; lastExpr = ''; fresh = false; break;
          case 'equals': commit(); return;
        }
      }
      render();
    }

    function commit() {
      const r = evaluate(expr);
      if (!r.ok) { error = r.error; render(); return; }
      if (r.value === null) return;
      history.unshift({ expr, result: formatRaw(r.value) });
      history.length = Math.min(history.length, HISTORY_MAX);
      saveHistory(history);
      lastExpr = expr;
      expr = formatRaw(r.value);
      fresh = true;
      render();
    }

    // ---------- History panel ----------
    function renderHistory() {
      elHistoryList.innerHTML = history.length
        ? history.map((h, i) => `
            <button type="button" class="calc-history-item" data-i="${i}">
              <span class="h-expr">${esc(h.expr)} =</span>
              <span class="h-result">${esc(formatNumber(Number(h.result)))}</span>
            </button>`).join('')
        : '<div class="app-empty">No calculations yet</div>';
    }
    function toggleHistory(show = elHistory.hidden) {
      elHistory.hidden = !show;
      btnHistory.setAttribute('aria-pressed', show);
      if (show) renderHistory(); else root.focus({ preventScroll: true });
    }

    btnHistory.addEventListener('click', () => toggleHistory());
    $('.btn-clear-history').addEventListener('click', () => { history = []; saveHistory(history); renderHistory(); });
    elHistoryList.addEventListener('click', (e) => {
      const item = e.target.closest('[data-i]');
      if (!item) return;
      const h = history[Number(item.dataset.i)];
      expr = h.result;
      lastExpr = h.expr;
      fresh = true;
      error = '';
      toggleHistory(false);
      render();
    });

    // ---------- Input ----------
    $('.calc-keys').addEventListener('click', (e) => {
      const key = e.target.closest('[data-act]');
      if (key) press(key.dataset.act);
    });
    // Keep keyboard focus on the calculator when clicking keys.
    $('.calc-keys').addEventListener('mousedown', (e) => e.preventDefault());

    root.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      let act = null;
      if (/^\d$/.test(e.key)) act = e.key;
      else if (e.key in KEY_MAP) act = KEY_MAP[e.key];
      else if (e.key === 'Enter' || e.key === '=') act = 'equals';
      else if (e.key === 'Backspace') act = 'back';
      else if (e.key === 'Escape' || e.key === 'Delete') act = 'clear';
      if (act === null) return;
      e.preventDefault();
      if (!elHistory.hidden) toggleHistory(false);
      press(act);
    });

    ctx.onFocus(() => root.focus({ preventScroll: true }));
    root.focus({ preventScroll: true });
    render();
  }
};
