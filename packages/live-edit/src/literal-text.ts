import { offsetOf, openTagEnd, type LiveAt } from './class-patch';
import { dataReason, dataSource, stringLiteral, type StringLiteral } from './data-source';
import type { FileChange, ReadFile } from './files';

export type TextWritten = { ok: true; change: FileChange } | { ok: false; reason: string; at?: LiveAt };

export type LiteralWritten = { ok: true; changes: FileChange[] } | { ok: false; reason: string; at?: LiveAt };

enum Kind {
  Text = 'text',
  Expression = 'expression',
  Tag = 'tag'
}

type Piece = { kind: Kind; raw: string; start: number };

const TAG_NAME = /^<([a-zA-Z][\w.-]*)/;
const WRAPPED = /^\s*(\{\{[^{}]*\}\}|\{[^{}]*\})\s*$/;
const PIECE = /\{\{[\s\S]*?\}\}|\{[^{}]*\}|<[^>]*>/g;
const ANY_EXPRESSION = /\{[^}]*\}/;
const MARKUP_CHARACTER = /[<{}]/;
const JSX_FILE = /\.(t|j)sx$/;
const LINE_BREAK = '\u0000';
const LINE_BREAK_MARKUP = '<br />';
const SPACE = ' ';
const UNMATCHED = 'the text does not match the source';

const collapse = (text: string) => text.replace(/\s+/g, SPACE);

const marked = (value: string) => value.replace(/\n/g, LINE_BREAK);

function atOffset(text: string, offset: number, file: string): LiveAt {
  const before = text.slice(0, offset).split('\n');
  return { file, line: before.length, col: before[before.length - 1].length + 1 };
}

function jsxText(raw: string): string {
  const lines = raw.split('\n');
  if (lines.length === 1) {
    return raw;
  }
  const trimmed = lines.map((line, i) => (i === 0 ? line.trimEnd() : i === lines.length - 1 ? line.trimStart() : line.trim()));
  return trimmed.filter(Boolean).join(SPACE);
}

function piecesOf(inner: string): Piece[] {
  const pieces: Piece[] = [];
  let last = 0;
  for (const found of inner.matchAll(PIECE)) {
    if (found.index > last) {
      pieces.push({ kind: Kind.Text, raw: inner.slice(last, found.index), start: last });
    }
    pieces.push({ kind: found[0].startsWith('<') ? Kind.Tag : Kind.Expression, raw: found[0], start: found.index });
    last = found.index + found[0].length;
  }
  if (last < inner.length) {
    pieces.push({ kind: Kind.Text, raw: inner.slice(last), start: last });
  }
  return pieces;
}

function escapedLiteral(value: string, quote: string): string {
  const safe = value.replace(/\\/g, '\\\\').split(quote).join(`\\${quote}`).replace(/\u0000/g, '\\n');
  return quote === '`' ? safe.replace(/\$\{/g, '\\${') : safe;
}

const literalChange = (literal: StringLiteral, value: string): FileChange => ({
  path: literal.path,
  before: literal.text,
  after: literal.text.slice(0, literal.start) + escapedLiteral(value, literal.quote) + literal.text.slice(literal.end)
});

function rawText(raw: string, dom: string): string {
  const lead = raw.match(/^\s*/)![0] || (dom.startsWith(SPACE) ? SPACE : '');
  const trail = raw.match(/\s*$/)![0] || (dom.endsWith(SPACE) ? SPACE : '');
  return lead + dom.trim().split(LINE_BREAK).join(LINE_BREAK_MARKUP) + trail;
}

async function refusedExpression(read: ReadFile, text: string, file: string, expression: string, offset: number): Promise<LiteralWritten> {
  const data = await dataSource(read, file, text, expression);
  if (data) {
    return { ok: false, reason: dataReason(data), at: data.at };
  }
  return { ok: false, reason: `This text comes from \`${expression}\`.`, at: atOffset(text, offset, file) };
}

type Edit = { piece: number; replaced: string };

function editOf(doms: string[], was: string, value: string): Edit | 'none' | null {
  const current = doms.join('');
  const next = collapse(marked(value));
  if (current !== collapse(was)) {
    return null;
  }
  let prefix = 0;
  while (prefix < current.length && prefix < next.length && current[prefix] === next[prefix]) {
    prefix++;
  }
  let suffix = 0;
  while (suffix < current.length - prefix && suffix < next.length - prefix && current[current.length - 1 - suffix] === next[next.length - 1 - suffix]) {
    suffix++;
  }
  const removed = current.length - suffix - prefix;
  const inserted = next.slice(prefix, next.length - suffix);
  if (!removed && !inserted) {
    return 'none';
  }
  let offset = 0;
  for (let piece = 0; piece < doms.length; piece++) {
    const end = offset + doms[piece].length;
    if (doms[piece].length && offset <= prefix && prefix + removed <= end) {
      const local = prefix - offset;
      return { piece, replaced: doms[piece].slice(0, local) + inserted + doms[piece].slice(local + removed) };
    }
    offset = end;
  }
  return null;
}

async function segmentText(read: ReadFile, text: string, at: LiveAt, pieces: Piece[], innerStart: number, was: string, value: string): Promise<LiteralWritten> {
  const literals = await Promise.all(pieces.map((p) => (p.kind === Kind.Expression ? stringLiteral(read, at.file, text, p.raw) : null)));
  const unresolved = pieces.findIndex((p, i) => p.kind === Kind.Expression && !literals[i]);
  if (unresolved >= 0) {
    return refusedExpression(read, text, at.file, pieces[unresolved].raw, innerStart + pieces[unresolved].start);
  }
  if (pieces.some((p) => p.kind === Kind.Text && /[{}]/.test(p.raw))) {
    return { ok: false, reason: `${at.file}:${at.line}: ${UNMATCHED}` };
  }

  const jsx = JSX_FILE.test(at.file);
  const doms = pieces.map((p, i) => {
    if (p.kind === Kind.Tag) {
      return '';
    }
    return collapse(p.kind === Kind.Expression ? literals[i]!.value : jsx ? jsxText(p.raw) : p.raw);
  });
  const edit = editOf(doms, was, value);
  if (edit === 'none') {
    return { ok: true, changes: [] };
  }
  if (!edit) {
    return { ok: false, reason: `${at.file}:${at.line}: ${UNMATCHED}, or the change spans several parts` };
  }

  const piece = pieces[edit.piece];
  if (piece.kind === Kind.Expression) {
    return { ok: true, changes: [literalChange(literals[edit.piece]!, edit.replaced)] };
  }
  const from = innerStart + piece.start;
  const after = text.slice(0, from) + rawText(piece.raw, edit.replaced) + text.slice(from + piece.raw.length);
  return { ok: true, changes: [{ path: at.file, before: text, after }] };
}

export async function literalText(read: ReadFile, at: LiveAt, value: string, was?: string): Promise<LiteralWritten> {
  const source = await read(at.file);
  const start = source === null ? -1 : offsetOf(source, at);
  const end = start < 0 || source![start] !== '<' ? -1 : openTagEnd(source!, start);
  const tag = end < 0 ? null : source!.slice(start).match(TAG_NAME)?.[1];
  const close = tag ? source!.indexOf(`</${tag}>`, end) : -1;
  if (close < 0) {
    return { ok: false, reason: `${at.file}:${at.line}: the element is not where the page says` };
  }
  if (MARKUP_CHARACTER.test(value)) {
    return { ok: false, reason: 'The text has characters that would be read as markup: not written.' };
  }

  const text = source!;
  const inner = text.slice(end + 1, close);
  const wrapped = inner.match(WRAPPED);
  if (wrapped) {
    const literal = await stringLiteral(read, at.file, text, wrapped[1]);
    if (literal) {
      return { ok: true, changes: [literalChange(literal, marked(value.trim()))] };
    }
    return refusedExpression(read, text, at.file, wrapped[1], end + 1 + inner.indexOf(wrapped[1]));
  }

  const pieces = piecesOf(inner);
  if (pieces.length > 1 || pieces[0]?.kind !== Kind.Text) {
    if (was === undefined) {
      const expression = inner.match(ANY_EXPRESSION);
      return expression ? refusedExpression(read, text, at.file, expression[0], end + 1 + expression.index!) : { ok: false, reason: `${at.file}:${at.line}: the text is mixed with markup, not written` };
    }
    return segmentText(read, text, at, pieces, end + 1, was, value);
  }

  const lead = inner.match(/^\s*/)![0];
  const trail = inner.match(/\s*$/)![0];
  const written = value.split('\n').join(LINE_BREAK_MARKUP);
  const after = text.slice(0, end + 1) + lead + written + trail + text.slice(close);
  return { ok: true, changes: [{ path: at.file, before: text, after }] };
}
