import { z } from 'zod';
import { codePoints, type Range } from './text-runs';

export enum ListKind {
  Bullet = 'bullet',
  Number = 'number'
}

export enum ListChange {
  Bullet = 'bullet',
  Number = 'number',
  None = 'none',
  Nest = 'nest',
  Lift = 'lift'
}

export type ListItem = { kind: ListKind; level: number } | null;

export const MAX_LIST_LEVEL = 5;
const MAX_PARAGRAPHS = 500;
export const LIST_STEP_EM = 1.5;
export const MARKER_GAP_EM = 0.4;

const BULLET = '•';
const NEWLINE = '\n';
const ALPHABET = 26;
const FIRST_LOWER = 97;

export const listsSchema = z
  .array(z.object({ kind: z.enum(ListKind), level: z.number().int().min(0).max(MAX_LIST_LEVEL) }).strict().nullable())
  .max(MAX_PARAGRAPHS)
  .optional();

const ROMAN: [number, string][] = [
  [10, 'x'],
  [9, 'ix'],
  [5, 'v'],
  [4, 'iv'],
  [1, 'i']
];

function roman(n: number): string {
  let rest = n;
  let out = '';
  for (const [value, glyph] of ROMAN) {
    while (rest >= value) {
      out += glyph;
      rest -= value;
    }
  }
  return out;
}

function alpha(n: number): string {
  const letter = String.fromCharCode(FIRST_LOWER + ((n - 1) % ALPHABET));
  return letter.repeat(Math.ceil(n / ALPHABET));
}

const DECIMAL_STYLES = [(n: number) => String(n), alpha, roman];

const numbered = (level: number, n: number) => `${DECIMAL_STYLES[level % DECIMAL_STYLES.length](n)}.`;

export function markersOf(lists: readonly ListItem[]): (string | null)[] {
  const counts: number[] = [];
  const kinds: (ListKind | undefined)[] = [];
  return lists.map((item) => {
    if (!item) {
      counts.length = 0;
      kinds.length = 0;
      return null;
    }
    counts.length = item.level + 1;
    kinds.length = item.level + 1;
    if (kinds[item.level] !== item.kind) {
      counts[item.level] = 0;
    }
    kinds[item.level] = item.kind;
    counts[item.level] = (counts[item.level] ?? 0) + 1;
    return item.kind === ListKind.Bullet ? BULLET : numbered(item.level, counts[item.level]);
  });
}

export function normalLists(lists: readonly ListItem[] | undefined, count: number): ListItem[] | undefined {
  const kept = (lists ?? []).slice(0, count);
  while (kept.length && kept.at(-1) === null) {
    kept.pop();
  }
  return kept.length ? kept : undefined;
}

const newlines = (chars: readonly string[]) => chars.filter((c) => c === NEWLINE).length;

export function shiftLists(lists: readonly ListItem[] | undefined, before: string, after: string): ListItem[] {
  const [a, b] = [codePoints(before), codePoints(after)];
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) {
    prefix++;
  }
  let suffix = 0;
  while (suffix < a.length - prefix && suffix < b.length - prefix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) {
    suffix++;
  }
  const at = newlines(a.slice(0, prefix));
  const removed = newlines(a.slice(prefix, a.length - suffix));
  const inserted = newlines(b.slice(prefix, b.length - suffix));
  const own = [...(lists ?? [])];
  while (own.length <= at) {
    own.push(null);
  }
  return normalLists([...own.slice(0, at + 1), ...Array.from({ length: inserted }, () => own[at]), ...own.slice(at + removed + 1)], Infinity) ?? [];
}

export function touched(text: string, range: Range): number[] {
  const chars = codePoints(text);
  const paragraphAt = (offset: number) => newlines(chars.slice(0, Math.min(offset, chars.length)));
  const first = paragraphAt(range.start);
  const last = range.end > range.start ? paragraphAt(range.end - 1) : first;
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

function padded(lists: readonly ListItem[], length: number): ListItem[] {
  return Array.from({ length }, (_, i) => lists[i] ?? null);
}

export function listedParagraphs(lists: readonly ListItem[], text: string, range: Range, kind: ListKind): ListItem[] {
  const hit = touched(text, range);
  const next = padded(lists, Math.max(lists.length, hit.at(-1)! + 1));
  const already = hit.every((p) => next[p]?.kind === kind);
  for (const p of hit) {
    next[p] = already ? null : { kind, level: next[p]?.level ?? 0 };
  }
  return normalLists(next, Infinity) ?? [];
}

export function indented(lists: readonly ListItem[], text: string, range: Range, by: 1 | -1): ListItem[] {
  const next = padded(lists, lists.length);
  for (const p of touched(text, range)) {
    const item = next[p];
    if (item) {
      next[p] = { ...item, level: Math.max(0, Math.min(MAX_LIST_LEVEL, item.level + by)) };
    }
  }
  return normalLists(next, Infinity) ?? [];
}

export const listedAt = (lists: readonly ListItem[] | undefined, paragraph: number): ListItem => lists?.[paragraph] ?? null;

export function unlisted(lists: readonly ListItem[], text: string, range: Range): ListItem[] {
  const next = padded(lists, lists.length);
  for (const p of touched(text, range)) {
    next[p] = null;
  }
  return normalLists(next, Infinity) ?? [];
}

const CHANGES: Record<ListChange, (lists: readonly ListItem[], text: string, range: Range) => ListItem[]> = {
  [ListChange.Bullet]: (lists, text, range) => listedParagraphs(lists, text, range, ListKind.Bullet),
  [ListChange.Number]: (lists, text, range) => listedParagraphs(lists, text, range, ListKind.Number),
  [ListChange.None]: unlisted,
  [ListChange.Nest]: (lists, text, range) => indented(lists, text, range, 1),
  [ListChange.Lift]: (lists, text, range) => indented(lists, text, range, -1)
};

export const listChanged = (lists: readonly ListItem[], text: string, range: Range, change: ListChange): ListItem[] => CHANGES[change](lists, text, range);
