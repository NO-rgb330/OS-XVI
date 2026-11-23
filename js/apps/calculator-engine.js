/* Calculator engine — a small recursive-descent parser (no eval).

   expr    := term (('+' | '-') term)*
   term    := unary (('*' | '/') unary | implicit-multiply operand)*
   unary   := ('+' | '-') unary | power
   power   := postfix ('^' unary)?          right-associative, -2^2 = -(2^2)
   postfix := primary '%'*
   primary := NUMBER | 'π' | '(' expr ')' | '√' postfix

   Missing closing parentheses and trailing operators are tolerated so that a
   live preview works while the user is still typing. */

export class CalcError extends Error {}

const NUMBER = /(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/iy;
const OPS = { '+': '+', '-': '-', '−': '-', '–': '-', '*': '*', '×': '*', '/': '/', '÷': '/', '^': '^' };

function tokenize(src) {
  const tokens = [];
  for (let i = 0; i < src.length;) {
    const c = src[i];
    if (c === ' ') { i++; continue; }
    NUMBER.lastIndex = i;
    const m = NUMBER.exec(src);
    if (m) { tokens.push({ t: 'num', v: parseFloat(m[0]) }); i += m[0].length; continue; }
    if (c in OPS) tokens.push({ t: 'op', v: OPS[c] });
    else if (c === '(' || c === ')' || c === '%' || c === '√') tokens.push({ t: c });
    else if (c === 'π') tokens.push({ t: 'num', v: Math.PI });
    else throw new CalcError('Invalid expression');
    i++;
  }
  return tokens;
}

function parse(tokens) {
  let p = 0;
  const peek = () => tokens[p];
  const isOp = (...ops) => peek()?.t === 'op' && ops.includes(peek().v);
  const startsOperand = () => {
    const t = peek();
    return t && (t.t === '(' || t.t === '√' || t.t === 'num');
  };

  function expr() {
    let l = term();
    while (isOp('+', '-')) { const op = tokens[p++].v; l = { k: 'bin', op, l, r: term() }; }
    return l;
  }
  function term() {
    let l = unary();
    for (;;) {
      if (isOp('*', '/')) { const op = tokens[p++].v; l = { k: 'bin', op, l, r: unary() }; }
      else if (peek()?.t === '(' || peek()?.t === '√') l = { k: 'bin', op: '*', l, r: unary() }; // 2(3), 2√9
      else return l;
    }
  }
  function unary() {
    if (isOp('+', '-')) {
      const op = tokens[p++].v;
      const a = unary();
      return op === '-' ? { k: 'neg', a } : a;
    }
    return power();
  }
  function power() {
    const base = postfix();
    if (isOp('^')) { p++; return { k: 'bin', op: '^', l: base, r: unary() }; }
    return base;
  }
  function postfix() {
    let a = primary();
    while (peek()?.t === '%') { p++; a = { k: 'pct', a }; }
    return a;
  }
  function primary() {
    const t = tokens[p++];
    if (!t) throw new CalcError('Invalid expression');
    if (t.t === 'num') return { k: 'num', v: t.v };
    if (t.t === '√') return { k: 'sqrt', a: isOp('+', '-') ? unary() : postfix() };
    if (t.t === '(') {
      const e = expr();
      if (peek()?.t === ')') p++; // an unclosed '(' at end of input is allowed
      return e;
    }
    throw new CalcError('Invalid expression');
  }

  const ast = expr();
  if (p < tokens.length) throw new CalcError('Invalid expression');
  return ast;
}

function ev(n) {
  switch (n.k) {
    case 'num': return n.v;
    case 'neg': return -ev(n.a);
    case 'pct': return ev(n.a) / 100;
    case 'sqrt': {
      const v = ev(n.a);
      if (v < 0) throw new CalcError('Invalid input');
      return Math.sqrt(v);
    }
    case 'bin': {
      // "50 + 10%" means 50 + 10% of 50, like a desk calculator.
      if ((n.op === '+' || n.op === '-') && n.r.k === 'pct') {
        const a = ev(n.l);
        const delta = (a * ev(n.r.a)) / 100;
        return n.op === '+' ? a + delta : a - delta;
      }
      const a = ev(n.l);
      const b = ev(n.r);
      switch (n.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/':
          if (b === 0) throw new CalcError(a === 0 ? 'Invalid input' : 'Cannot divide by zero');
          return a / b;
        case '^': {
          const r = Math.pow(a, b);
          if (Number.isNaN(r)) throw new CalcError('Invalid input');
          return r;
        }
      }
    }
  }
  throw new CalcError('Invalid expression');
}

/**
 * Evaluate an expression string.
 * → { ok: true, value: number | null }   (null when there is nothing to evaluate)
 * → { ok: false, error: string }
 */
export function evaluate(src) {
  try {
    const tokens = tokenize(src);
    // Ignore dangling operators / open brackets: "5+" previews as 5.
    while (tokens.length && (tokens.at(-1).t === 'op' || tokens.at(-1).t === '(' || tokens.at(-1).t === '√')) tokens.pop();
    if (!tokens.length) return { ok: true, value: null };

    const raw = ev(parse(tokens));
    if (!Number.isFinite(raw)) throw new CalcError('Overflow');
    // 14 significant digits hides binary float noise (0.1 + 0.2 → 0.3).
    const value = Number(raw.toPrecision(14));
    return { ok: true, value: Object.is(value, -0) ? 0 : value };
  } catch (e) {
    if (e instanceof CalcError) return { ok: false, error: e.message };
    throw e;
  }
}

/** Plain string that evaluate() can parse back in (used when a result becomes the next expression). */
export const formatRaw = (n) => String(n).replace('e+', 'e');

/** Display string with thousands separators. */
export function formatNumber(n) {
  const s = formatRaw(n);
  if (s.includes('e')) return s;
  const [int, frac] = s.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? `${grouped}.${frac}` : grouped;
}
