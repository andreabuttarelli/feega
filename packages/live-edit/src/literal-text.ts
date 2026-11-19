import { offsetOf, openTagEnd, type LiveAt } from './class-patch';
import { dataReason, dataSource } from './data-source';
import type { FileChange, ReadFile } from './files';

export type TextWritten = { ok: true; change: FileChange } | { ok: false; reason: string; at?: LiveAt };

const TAG_NAME = /^<([a-zA-Z][\w.-]*)/;
const EXPRESSION = /\{[^}]*\}/;
const MARKUP = /</;

function atOffset(text: string, offset: number, file: string): LiveAt {
  const before = text.slice(0, offset).split('\n');
  return { file, line: before.length, col: before[before.length - 1].length + 1 };
}

export async function literalText(read: ReadFile, at: LiveAt, value: string): Promise<TextWritten> {
  const source = await read(at.file);
  const start = source === null ? -1 : offsetOf(source, at);
  const end = start < 0 || source![start] !== '<' ? -1 : openTagEnd(source!, start);
  const tag = end < 0 ? null : source!.slice(start).match(TAG_NAME)?.[1];
  const close = tag ? source!.indexOf(`</${tag}>`, end) : -1;
  if (close < 0) {
    return { ok: false, reason: `${at.file}:${at.line}: the element is not where the page says` };
  }

  const text = source!;
  const inner = text.slice(end + 1, close);
  const expression = inner.match(EXPRESSION);
  if (expression) {
    const data = await dataSource(read, at.file, text, expression[0]);
    if (data) {
      return { ok: false, reason: dataReason(data), at: data.at };
    }
    return { ok: false, reason: `This text comes from \`${expression[0]}\`.`, at: atOffset(text, end + 1 + expression.index!, at.file) };
  }
  if (MARKUP.test(inner)) {
    return { ok: false, reason: `${at.file}:${at.line}: the text is mixed with markup, not written` };
  }

  const lead = inner.match(/^\s*/)![0];
  const trail = inner.match(/\s*$/)![0];
  const after = text.slice(0, end + 1) + lead + value + trail + text.slice(close);
  return { ok: true, change: { path: at.file, before: text, after } };
}
