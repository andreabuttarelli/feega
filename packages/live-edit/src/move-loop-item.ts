import { offsetOf, openTagEnd, type LiveAt } from './class-patch';
import type { ReadFile } from './files';
import type { Structured } from './move-into';
import { hiddenOut } from './move-node';

export type LoopMove = { from: number; to: number };

type Piece = { start: number; end: number };

const OPENERS = '([{';
const CLOSERS = ')]}';
const QUOTES = '"\'`';
const NOT_ARRAY = 'the loop does not run over an array literal in this file: change the order in the data source';
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

function loopName(text: string, start: number): string | null {
  const open = text.slice(start, openTagEnd(text, start) + 1);
  return open.match(V_FOR)?.[1] ?? eachName(text, start) ?? mapName(text, start);
}

function piecesOf(source: string, open: number): Piece[] | null {
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

export async function moveLoopItem(read: ReadFile, at: LiveAt, move: LoopMove): Promise<Structured> {
  const source = await read(at.file);
  if (source === null) {
    return { ok: false, reason: `${at.file}: cannot read the file` };
  }

  const name = loopName(hiddenOut(source), offsetOf(source, at));
  const declared = name ? new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*(?::[^=]+)?=\\s*\\[`).exec(source) : null;
  const pieces = declared ? piecesOf(source, declared.index + declared[0].length - 1) : null;
  if (!pieces) {
    return { ok: false, reason: NOT_ARRAY, at };
  }
  if (!pieces[move.from] || !pieces[move.to]) {
    return { ok: false, reason: 'the item is outside the array', at };
  }

  const order = pieces.map((_, i) => i);
  order.splice(move.to, 0, ...order.splice(move.from, 1));
  const texts = pieces.map((p) => source.slice(p.start, p.end));
  const after = pieces.reduceRight((text, p, i) => text.slice(0, p.start) + texts[order[i]] + text.slice(p.end), source);
  return { ok: true, changes: [{ path: at.file, before: source, after }] };
}
