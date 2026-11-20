import { openTagEnd, type LiveAt } from './class-patch';

export enum Delimiter {
  Double = '"',
  Single = "'",
  Brace = '{',
  None = '',
  Shorthand = 'shorthand'
}

export type Attribute = { name: string; value: string | null; delimiter: Delimiter; start: number; end: number; valueStart: number; valueEnd: number };

const TAG_NAME = /^<([a-zA-Z][\w.:-]*)/;
const NAME_END = /[\s=>]/;
const SPACE = /\s/;
const QUOTES = new Set(['"', "'", '`']);

export const tagNameAt = (text: string, start: number) => text.slice(start).match(TAG_NAME)?.[1] ?? null;

function braceClose(text: string, open: number): number {
  let depth = 0;
  let quote = '';
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      quote = ch === quote && text[i - 1] !== '\\' ? '' : quote;
      continue;
    }
    if (QUOTES.has(ch)) {
      quote = ch;
      continue;
    }
    depth += ch === '{' ? 1 : ch === '}' ? -1 : 0;
    if (depth === 0) {
      return i;
    }
  }
  return text.length;
}

function shorthand(text: string, from: number, limit: number): Attribute {
  const close = Math.min(braceClose(text, from), limit - 1);
  return { name: text.slice(from + 1, close).trim(), value: null, delimiter: Delimiter.Shorthand, start: from, end: close + 1, valueStart: from + 1, valueEnd: close };
}

function valueOf(text: string, from: number, limit: number): Pick<Attribute, 'delimiter' | 'valueStart' | 'valueEnd' | 'end'> {
  const ch = text[from];
  if (ch === '"' || ch === "'") {
    const close = text.indexOf(ch, from + 1);
    const valueEnd = close < 0 || close >= limit ? limit : close;
    return { delimiter: ch as Delimiter, valueStart: from + 1, valueEnd, end: valueEnd + 1 };
  }
  if (ch === '{') {
    const close = Math.min(braceClose(text, from), limit - 1);
    return { delimiter: Delimiter.Brace, valueStart: from + 1, valueEnd: close, end: close + 1 };
  }
  let end = from;
  while (end < limit && !SPACE.test(text[end])) {
    end++;
  }
  return { delimiter: Delimiter.None, valueStart: from, valueEnd: end, end };
}

function named(text: string, from: number, limit: number): Attribute {
  let nameEnd = from;
  while (nameEnd < limit && !NAME_END.test(text[nameEnd])) {
    nameEnd++;
  }
  const name = text.slice(from, nameEnd);
  if (text[nameEnd] !== '=' || nameEnd >= limit) {
    return { name, value: null, delimiter: Delimiter.None, start: from, end: Math.max(nameEnd, from + 1), valueStart: nameEnd, valueEnd: nameEnd };
  }
  const value = valueOf(text, nameEnd + 1, limit);
  return { name, value: text.slice(value.valueStart, value.valueEnd), start: from, ...value };
}

export function attributesOf(text: string, start: number): Attribute[] {
  const end = openTagEnd(text, start);
  const tag = tagNameAt(text, start);
  if (end < 0 || !tag) {
    return [];
  }
  const limit = text[end - 1] === '/' ? end - 1 : end;
  const found: Attribute[] = [];
  let i = start + 1 + tag.length;
  while (i < limit) {
    if (SPACE.test(text[i])) {
      i++;
      continue;
    }
    const attribute = text[i] === '{' ? shorthand(text, i, limit) : named(text, i, limit);
    found.push(attribute);
    i = attribute.end;
  }
  return found;
}

export function locationOf(text: string, offset: number, file: string): LiveAt {
  const before = text.slice(0, offset).split('\n');
  return { file, line: before.length, col: before[before.length - 1].length + 1 };
}

export function insertAttribute(text: string, start: number, fragment: string): string {
  const end = openTagEnd(text, start);
  const closing = text[end - 1] === '/' ? end - 1 : end;
  const at = text.slice(0, closing).trimEnd().length;
  return `${text.slice(0, at)} ${fragment}${text.slice(at)}`;
}

export function removeAttribute(text: string, attribute: Attribute): string {
  const from = text.slice(0, attribute.start).trimEnd().length;
  return text.slice(0, from) + text.slice(attribute.end);
}
