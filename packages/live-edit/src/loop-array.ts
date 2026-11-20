import { openTagEnd } from './class-patch';

export type Piece = { start: number; end: number };

const OPENERS = '([{';
const CLOSERS = ')]}';
const QUOTES = '"\'`';
const V_FOR = /\sv-for="[^"]*?\bin\s+([A-Za-z_$][\w$]*)\s*"/;
const EACH = /\{#each\s+([A-Za-z_$][\w$]*)\s+as\b|\{\/each\}/g;
const MAP = /([A-Za-z_$][\w$]*)\.map\(/g;

function eachName(text: string, until: number): string | null {
  const open: string[] = [];
  EACH.lastIndex = 0;
  for (let m = EACH.exec(text); m && m.index < until; m = EACH.exec(text)) {
    if (m[1]) {
      open.push(m[1]);
      continue;
    }
    open.pop();
  }
  return open.at(-1) ?? null;
}

function mapName(text: string, until: number): string | null {
  const before = text.slice(0, until);
  const calls = [...before.matchAll(MAP)];
  for (const call of calls.reverse()) {
    const depth = [...before.slice(call.index + call[0].length)].reduce((sum, ch) => sum + (ch === '(' ? 1 : ch === ')' ? -1 : 0), 1);
    if (depth > 0) {
      return call[1];
    }
  }
  return null;
}

export function loopName(text: string, start: number): string | null {
  const open = text.slice(start, openTagEnd(text, start) + 1);
  return open.match(V_FOR)?.[1] ?? eachName(text, start) ?? mapName(text, start);
}

export function piecesOf(source: string, open: number): Piece[] | null {
  const pieces: Piece[] = [];
  let depth = 0;
  let quote = '';
  let from = open + 1;
  for (let i = open + 1; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      quote = ch === quote && source[i - 1] !== '\\' ? '' : quote;
      continue;
    }
    if (QUOTES.includes(ch)) {
      quote = ch;
      continue;
    }
    depth += OPENERS.includes(ch) ? 1 : 0;
    const last = depth === 0 && ch === ']';
    depth -= CLOSERS.includes(ch) && !last ? 1 : 0;
    if ((ch === ',' && depth === 0) || last) {
      pieces.push({ start: from, end: i });
      from = i + 1;
    }
    if (last) {
      return pieces.map((p) => trimmed(source, p)).filter((p) => p.end > p.start);
    }
  }
  return null;
}

function trimmed(source: string, piece: Piece): Piece {
  const text = source.slice(piece.start, piece.end);
  const lead = text.length - text.trimStart().length;
  return { start: piece.start + lead, end: piece.start + lead + text.trim().length };
}
