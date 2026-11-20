import { offsetOf, openTagEnd, type LiveAt } from './class-patch';
import type { ReadFile } from './files';
import type { TextWritten } from './literal-text';

export enum Place {
  Before = 'before',
  After = 'after',
  Inside = 'inside'
}

export type Span = { start: number; end: number };

const TAG_AT = /^<([a-zA-Z][\w.:-]*)/;
const TAG = /<(\/?)([a-zA-Z][\w.:-]*)/g;
const HIDDEN_BLOCK = /<(script|style)\b[\s\S]*?<\/\1>/g;
const EACH_OPEN = /\{#each\b/g;
const EACH_CLOSE = /\{\/each\}/g;
const MAP_CALL = /\.map\(/;

export const hiddenOut = (text: string) => text.replace(HIDDEN_BLOCK, (block) => block.replace(/[^\n]/g, ' '));

export function spanOf(text: string, start: number): Span | null {
  const name = text.slice(start).match(TAG_AT)?.[1];
  const openEnd = name ? openTagEnd(text, start) : -1;
  if (!name || openEnd < 0) {
    return null;
  }
  if (text[openEnd - 1] === '/') {
    return { start, end: openEnd + 1 };
  }
  const same = new RegExp(`<(/?)${name.replace(/[.]/g, '\\.')}(?=[\\s/>])`, 'g');
  same.lastIndex = openEnd + 1;
  let depth = 1;
  for (let m = same.exec(text); m; m = same.exec(text)) {
    const tagEnd = openTagEnd(text, m.index);
    const selfClosing = !m[1] && text[tagEnd - 1] === '/';
    depth += m[1] ? -1 : selfClosing ? 0 : 1;
    if (depth === 0) {
      return { start, end: tagEnd + 1 };
    }
  }
  return null;
}

export function parentOf(text: string, start: number): number {
  const stack: number[] = [];
  TAG.lastIndex = 0;
  for (let m = TAG.exec(text); m && m.index < start; m = TAG.exec(text)) {
    if (m[1]) {
      stack.pop();
      continue;
    }
    const end = openTagEnd(text, m.index);
    if (end > 0 && text[end - 1] !== '/') {
      stack.push(m.index);
    }
  }
  return stack.at(-1) ?? -1;
}

export function repeated(text: string, parent: number, start: number): string | null {
  const between = text.slice(parent, start);
  const opened = (between.match(EACH_OPEN)?.length ?? 0) - (between.match(EACH_CLOSE)?.length ?? 0);
  if (opened > 0) {
    return 'the element is rendered by an {#each} block: reorder the data instead, or use CSS order';
  }
  return MAP_CALL.test(between) ? 'the element is rendered by .map(): reorder the data instead, or use CSS order' : null;
}

export function lineSpan(text: string, span: Span): Span {
  const lineStart = text.lastIndexOf('\n', span.start - 1) + 1;
  const lineEnd = text.indexOf('\n', span.end);
  const whole = !text.slice(lineStart, span.start).trim() && !text.slice(span.end, lineEnd < 0 ? text.length : lineEnd).trim();
  return whole ? { start: lineStart, end: lineEnd < 0 ? text.length : lineEnd + 1 } : span;
}

export async function moveNode(read: ReadFile, from: LiveAt, to: LiveAt, place: Place): Promise<TextWritten> {
  const source = await read(from.file);
  if (source === null || from.file !== to.file) {
    return { ok: false, reason: 'both elements must be in the same file' };
  }

  const text = hiddenOut(source);
  const moving = spanOf(text, offsetOf(text, from));
  const target = spanOf(text, offsetOf(text, to));
  if (!moving || !target) {
    return { ok: false, reason: `${from.file}: the elements are not where the page says` };
  }

  const parent = parentOf(text, moving.start);
  if (parent !== parentOf(text, target.start)) {
    return { ok: false, reason: 'only siblings in the same parent can be reordered' };
  }
  const why = repeated(text, parent, moving.start) ?? repeated(text, parent, target.start);
  if (why) {
    return { ok: false, reason: why, at: from };
  }

  const cut = lineSpan(source, moving);
  const piece = source.slice(cut.start, cut.end);
  const without = source.slice(0, cut.start) + source.slice(cut.end);
  const shift = (offset: number) => (offset > cut.start ? offset - (cut.end - cut.start) : offset);
  const anchor = lineSpan(source, target);
  const insertAt = shift(place === Place.Before ? anchor.start : anchor.end);
  const after = without.slice(0, insertAt) + piece + without.slice(insertAt);
  return { ok: true, change: { path: from.file, before: source, after } };
}
