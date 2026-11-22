import { offsetOf, type LiveAt } from './class-patch';
import type { ReadFile } from './files';
import { withAttribute } from './link-edit';
import type { TextWritten } from './literal-text';
import { elementRange } from './element-range';
import { tagNameAt } from './open-tag';

const UNSAFE_VALUE = /["\r\n{}]/;

function tagStart(text: string, from: number, tag: string): number {
  const range = elementRange(text, from);
  const found = range ? new RegExp(`<${tag}(?=[\\s/>])`).exec(text.slice(range.openEnd + 1, range.end)) : null;
  return range && found ? range.openEnd + 1 + found.index : -1;
}

export async function setAttributes(read: ReadFile, at: LiveAt, set: Record<string, string>, tag?: string): Promise<TextWritten> {
  const text = await read(at.file);
  if (text === null) {
    return { ok: false, reason: `${at.file}: cannot read the file` };
  }
  const origin = offsetOf(text, at);
  const start = tag ? tagStart(text, origin, tag) : origin;
  if (start < 0 || text[start] !== '<' || !tagNameAt(text, start)) {
    return { ok: false, reason: `${at.file}:${at.line}: the element is not where the page says`, at };
  }
  if (Object.values(set).some((value) => UNSAFE_VALUE.test(value))) {
    return { ok: false, reason: 'a value has characters that would break the source: not written', at };
  }
  const after = Object.entries(set).reduce((current, [name, value]) => withAttribute(current, start, name, value), text);
  return { ok: true, change: { path: at.file, before: text, after } };
}
