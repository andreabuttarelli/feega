import { offsetOf, type LiveAt } from './class-patch';
import { elementRange } from './element-range';
import type { ReadFile } from './files';
import { indentOf, type Structured } from './move-into';
import { hiddenOut, lineSpan, parentOf, repeated } from './move-node';

const INDENT_UNIT = '  ';
const WRAPPER_OPEN = '<div>';
const WRAPPER_CLOSE = '</div>';

type Located = { source: string; text: string; start: number };

const lineCol = (text: string, offset: number) => {
  const lines = text.slice(0, offset).split('\n');
  return { line: lines.length, col: lines[lines.length - 1].length + 1 };
};

async function located(read: ReadFile, at: LiveAt): Promise<Located | string> {
  const source = await read(at.file);
  if (source === null) {
    return `${at.file}: cannot read the file`;
  }

  const text = hiddenOut(source);
  const start = offsetOf(text, at);
  return repeated(text, parentOf(text, start), start) ?? { source, text, start };
}

const lined = (piece: string, prefix: string) =>
  piece
    .replace(/\n$/, '')
    .split('\n')
    .map((l) => (l.trim() ? prefix + l : l))
    .join('\n');

const dedented = (block: string) =>
  block
    .split('\n')
    .map((l) => (l.startsWith(INDENT_UNIT) ? l.slice(INDENT_UNIT.length) : l))
    .join('\n');

export async function wrapNode(read: ReadFile, at: LiveAt): Promise<Structured> {
  const found = await located(read, at);
  if (typeof found === 'string') {
    return { ok: false, reason: found, at };
  }

  const { source, text, start } = found;
  const range = elementRange(text, start);
  if (!range) {
    return { ok: false, reason: `${at.file}: the element is not where the page says` };
  }

  const whole = lineSpan(source, range);
  const inline = whole.start === range.start && whole.end === range.end;
  const indent = indentOf(source.slice(source.lastIndexOf('\n', range.start - 1) + 1));
  const piece = source.slice(whole.start, whole.end);
  const block = inline ? `${WRAPPER_OPEN}${piece}${WRAPPER_CLOSE}` : `${indent}${WRAPPER_OPEN}\n${lined(piece, INDENT_UNIT)}\n${indent}${WRAPPER_CLOSE}${piece.endsWith('\n') ? '\n' : ''}`;
  const after = source.slice(0, whole.start) + block + source.slice(whole.end);
  const inside = inline ? whole.start + WRAPPER_OPEN.length : after.indexOf('<', whole.start + indent.length + WRAPPER_OPEN.length);
  return { ok: true, changes: [{ path: at.file, before: source, after }], selected: { file: at.file, ...lineCol(after, inside) } };
}

export async function unwrapNode(read: ReadFile, at: LiveAt): Promise<Structured> {
  const found = await located(read, at);
  if (typeof found === 'string') {
    return { ok: false, reason: found, at };
  }

  const { source, text, start } = found;
  const range = elementRange(text, start);
  if (!range || range.end === range.openEnd + 1) {
    return { ok: false, reason: 'the element has no children to unwrap', at };
  }

  const whole = lineSpan(source, range);
  const inner = source.slice(range.openEnd + 1, range.closeStart);
  const stacked = whole.start !== range.start || whole.end !== range.end;
  const block = stacked ? dedented(inner.replace(/^[ \t]*\n/, '').replace(/\n[ \t]*$/, '\n')) : inner.trim();
  const after = source.slice(0, whole.start) + block + source.slice(whole.end);
  return { ok: true, changes: [{ path: at.file, before: source, after }] };
}
