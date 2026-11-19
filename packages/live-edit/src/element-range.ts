import { openTagEnd } from './class-patch';

export type ElementRange = { tag: string; start: number; openEnd: number; end: number; closeStart: number };

const TAG_NAME = /^<([a-zA-Z][\w.:-]*)/;

export function elementRange(text: string, start: number): ElementRange | null {
  const tag = text.slice(start).match(TAG_NAME)?.[1];
  const openEnd = tag ? openTagEnd(text, start) : -1;
  if (!tag || openEnd < 0) {
    return null;
  }
  if (text[openEnd - 1] === '/') {
    return { tag, start, openEnd, end: openEnd + 1, closeStart: openEnd + 1 };
  }
  const nesting = new RegExp(`<${tag}(?=[\\s/>])|</${tag}>`, 'g');
  nesting.lastIndex = openEnd + 1;
  let depth = 1;
  for (let found = nesting.exec(text); found; found = nesting.exec(text)) {
    depth += found[0].startsWith('</') ? -1 : 1;
    if (depth === 0) {
      return { tag, start, openEnd, end: found.index + found[0].length, closeStart: found.index };
    }
  }
  return null;
}
