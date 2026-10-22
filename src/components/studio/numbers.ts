/**
 * Numbers typed into the inspector: plain sums like "1200 - 80" or "3 * (40 + 2)", with "%" and
 * "px" after a number for a share of the flag or a pixel count, whatever the field shows.
 */
export function evaluate(text: string, units: { percent: number; px: number }): number | null {
  const src = text.replace(/\s+/g, '').replace(/,/g, '.').replace(/×/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-');
  if (!src) return null;
  let i = 0;
  const peek = () => src[i];

  function sum(): number {
    let n = product();
    while (peek() === '+' || peek() === '-') n = src[i++] === '+' ? n + product() : n - product();
    return n;
  }
  function product(): number {
    let n = unary();
    while (peek() === '*' || peek() === '/') n = src[i++] === '*' ? n * unary() : n / unary();
    return n;
  }
  function unary(): number {
    if (peek() === '-') return (i++, -unary());
    if (peek() === '+') return (i++, unary());
    let n: number;
    if (peek() === '(') {
      i++;
      n = sum();
      if (src[i++] !== ')') throw new Error();
    } else {
      const match = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i));
      if (!match) throw new Error();
      i += match[0].length;
      n = Number(match[0]);
    }
    if (peek() === '%') return (i++, (n / 100) * units.percent);
    if (src.startsWith('px', i)) return ((i += 2), n * units.px);
    return n;
  }

  try {
    const n = sum();
    return i === src.length && Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** The simplest fraction within `tolerance` of n with a denominator up to `max`, or null. */
export function fraction(n: number, max = 64, tolerance = 5e-5): [number, number] | null {
  for (let q = 1; q <= max; q++) {
    const p = Math.round(n * q);
    if (Math.abs(n - p / q) < tolerance) return [p, q];
  }
  return null;
}

/** A share of the flag as a fraction when it is one ("5/12"), else to four places. */
export function formatShare(n: number): string {
  const f = fraction(n);
  if (f) return f[1] === 1 ? String(f[0]) : `${f[0]}/${f[1]}`;
  return String(Math.round(n * 10000) / 10000);
}
