import { offsetOf, type LiveAt } from './class-patch';
import { elementRange } from './element-range';
import type { ReadFile } from './files';
import type { TextWritten } from './literal-text';

export const TEXT_TAGS: readonly string[] = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'label', 'blockquote', 'strong', 'em', 'small'];

export const isTextTag = (tag: string) => TEXT_TAGS.includes(tag);

export async function retag(read: ReadFile, at: LiveAt, to: string): Promise<TextWritten> {
  const text = await read(at.file);
  if (text === null) {
    return { ok: false, reason: `${at.file}: cannot read the file` };
  }
  const start = offsetOf(text, at);
  const range = text[start] === '<' ? elementRange(text, start) : null;
  if (!range || !isTextTag(range.tag) || !isTextTag(to) || range.tag === to) {
    return { ok: false, reason: `${at.file}:${at.line}: not a text tag that can become <${to}>`, at };
  }
  if (!text.startsWith(`</${range.tag}>`, range.closeStart)) {
    return { ok: false, reason: `${at.file}:${at.line}: the closing tag is not where the page says`, at };
  }
  const closed = text.slice(0, range.closeStart) + `</${to}>` + text.slice(range.closeStart + range.tag.length + 3);
  const after = closed.slice(0, start + 1) + to + closed.slice(start + 1 + range.tag.length);
  return { ok: true, change: { path: at.file, before: text, after } };
}
