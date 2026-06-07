// Safe arithmetic for quantity fields (B-108): let the user type a calculation (e.g. "950/2")
// and store the numeric result — no formula kept. A tiny recursive-descent evaluator over
// `+ - * / ( )` and decimals; NEVER `eval` (untrusted input). Pure, locale-tolerant (comma
// decimal). This is input convenience, not a nutrition computation (CLAUDE.md rule 2 untouched).

const NUMBER = /[0-9.]/;
const VALID = /^[0-9.+\-*/() ]+$/;

/** Tokenise into numbers + single-char operators/parens; throws on an unexpected character. */
function tokenize(s: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (c === ' ') {
      i++;
    } else if ('+-*/()'.includes(c)) {
      tokens.push(c);
      i++;
    } else {
      let j = i;
      while (j < s.length && NUMBER.test(s[j]!)) j++;
      if (j === i) throw new Error('unexpected');
      tokens.push(s.slice(i, j));
      i = j;
    }
  }
  return tokens;
}

/** Recursive-descent parser/evaluator. Grammar: expr = term (('+'|'-') term)*,
 *  term = factor (('*'|'/') factor)*, factor = number | '(' expr ')' | ('+'|'-') factor. */
function evaluate(tokens: string[]): number {
  let pos = 0;
  const peek = (): string | undefined => tokens[pos];

  function factor(): number {
    const t = peek();
    if (t === undefined) throw new Error('eof');
    if (t === '+' || t === '-') {
      pos++;
      const v = factor();
      return t === '-' ? -v : v;
    }
    if (t === '(') {
      pos++;
      const v = expr();
      if (peek() !== ')') throw new Error('paren');
      pos++;
      return v;
    }
    const n = Number(t);
    if (!Number.isFinite(n)) throw new Error('nan'); // rejects "1.2.3", stray operators
    pos++;
    return n;
  }

  function term(): number {
    let v = factor();
    while (peek() === '*' || peek() === '/') {
      const op = tokens[pos++];
      const rhs = factor();
      v = op === '*' ? v * rhs : v / rhs;
    }
    return v;
  }

  function expr(): number {
    let v = term();
    while (peek() === '+' || peek() === '-') {
      const op = tokens[pos++];
      const rhs = term();
      v = op === '+' ? v + rhs : v - rhs;
    }
    return v;
  }

  const result = expr();
  if (pos !== tokens.length) throw new Error('trailing');
  return result;
}

/** Evaluate a quantity expression. Empty → 0; a valid finite result → that number; anything
 *  invalid (bad chars, malformed, division by zero) → null so the caller can keep the previous
 *  value. Accepts the French decimal comma. */
export function evalQuantity(raw: string): number | null {
  const s = raw.trim().replace(/,/g, '.');
  if (s === '') return 0;
  if (!VALID.test(s)) return null;
  try {
    const v = evaluate(tokenize(s));
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}
