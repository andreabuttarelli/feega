const REM_PX = 16;
const CALC = /^calc\((.*)\)$/s;
const TERM = /^\s*(-?\d*\.?\d+)(px|rem)?\s*/;

type Cursor = { text: string; at: number };

function number(c: Cursor): number | null {
  const rest = c.text.slice(c.at);
  if (rest.trimStart().startsWith('(')) {
    c.at += rest.indexOf('(') + 1;
    const inner = sum(c);
    const close = c.text.slice(c.at).match(/^\s*\)/);
    c.at += close ? close[0].length : 0;
    return close ? inner : null;
  }
  const m = TERM.exec(rest);
  if (!m) {
    return null;
  }
  c.at += m[0].length;
  return Number(m[1]) * (m[2] === 'rem' ? REM_PX : 1);
}

function product(c: Cursor): number | null {
  let value = number(c);
  for (let op = /^([*/])\s*/.exec(c.text.slice(c.at)); value !== null && op; op = /^([*/])\s*/.exec(c.text.slice(c.at))) {
    c.at += op[0].length;
    const next = number(c);
    value = next === null || (op[1] === '/' && next === 0) ? null : op[1] === '*' ? value * next : value / next;
  }
  return value;
}

function sum(c: Cursor): number | null {
  let value = product(c);
  for (let op = /^([+-])\s+/.exec(c.text.slice(c.at)); value !== null && op; op = /^([+-])\s+/.exec(c.text.slice(c.at))) {
    c.at += op[0].length;
    const next = product(c);
    value = next === null ? null : op[1] === '+' ? value + next : value - next;
  }
  return value;
}

export function constantCalcPx(raw: string): number | null {
  const inner = CALC.exec(raw.trim())?.[1];
  if (inner === undefined || /var\(|%|[a-z]{3,}\(/i.test(inner)) {
    return null;
  }
  const cursor = { text: inner.trim(), at: 0 };
  const value = sum(cursor);
  return value !== null && cursor.at === cursor.text.length && Number.isFinite(value) ? value : null;
}
