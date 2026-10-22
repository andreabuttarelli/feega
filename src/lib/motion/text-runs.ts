import { z } from 'zod';

const MIN_WEIGHT = 100;
const MAX_WEIGHT = 900;
const MAX_RUNS = 200;
export const BOLD = 700;

const runStyleShape = {
  color: z.string().min(1).max(64).optional(),
  weight: z.number().int().min(MIN_WEIGHT).max(MAX_WEIGHT).optional(),
  italic: z.boolean().optional()
};

export const runSchema = z.object({ start: z.number().int().min(0), end: z.number().int().min(1), ...runStyleShape }).strict();

export const runsSchema = z.array(runSchema).max(MAX_RUNS).optional();

export type RunStyle = { color?: string; weight?: number; italic?: boolean };
export type TextRun = { start: number; end: number } & RunStyle;
export type Range = { start: number; end: number };
export type Segment = { text: string; run: TextRun | null };

export enum RunToggle {
  Bold = 'bold',
  Italic = 'italic'
}

export type RunEdit = { color?: string | null; weight?: number | RunToggle.Bold | null; italic?: boolean | RunToggle.Italic | null };

const STYLE_KEYS = ['color', 'weight', 'italic'] as const;

type Chars = (RunStyle | null)[];

const styleOf = (run: TextRun): RunStyle | null => {
  const style = Object.fromEntries(STYLE_KEYS.filter((k) => run[k] !== undefined).map((k) => [k, run[k]])) as RunStyle;
  return Object.keys(style).length ? style : null;
};

const sameStyle = (a: RunStyle | null, b: RunStyle | null) => STYLE_KEYS.every((k) => a?.[k] === b?.[k]);

function charsOf(runs: readonly TextRun[], length: number): Chars {
  const chars: Chars = Array.from({ length }, () => null);
  for (const run of runs) {
    for (let i = Math.max(0, run.start); i < Math.min(length, run.end); i++) {
      chars[i] = { ...chars[i], ...styleOf(run) };
    }
  }
  return chars;
}

function runsOf(chars: Chars): TextRun[] {
  const runs: TextRun[] = [];
  chars.forEach((style, i) => {
    const last = runs.at(-1);
    if (!style) {
      return;
    }
    if (last && last.end === i && sameStyle(styleOf(last), style)) {
      last.end = i + 1;
      return;
    }
    runs.push({ start: i, end: i + 1, ...style });
  });
  return runs;
}

export const codePoints = (text: string) => [...text];

export const codeIndex = (text: string, utf16: number) => [...text.slice(0, utf16)].length;

export const normalRuns = (runs: readonly TextRun[] | undefined, length: number): TextRun[] => runsOf(charsOf(runs ?? [], length));

const everyChar = (chars: Chars, range: Range, has: (s: RunStyle | null) => boolean) => chars.slice(range.start, range.end).every(has);

const TOGGLES: { [K in keyof RunEdit]-?: (edit: NonNullable<RunEdit[K]>, chars: Chars, range: Range) => RunStyle[K] } = {
  color: (edit) => edit as string,
  weight: (edit, chars, range) => (edit === RunToggle.Bold ? (everyChar(chars, range, (s) => (s?.weight ?? 0) >= BOLD) ? undefined : BOLD) : (edit as number)),
  italic: (edit, chars, range) => (edit === RunToggle.Italic ? (everyChar(chars, range, (s) => s?.italic === true) ? undefined : true) : (edit as boolean))
};

export function styledRange(runs: readonly TextRun[] | undefined, range: Range, edit: RunEdit, length: number): TextRun[] {
  const chars = charsOf(runs ?? [], length);
  const span = { start: Math.max(0, range.start), end: Math.min(length, range.end) };
  const resolved = Object.fromEntries(
    STYLE_KEYS.filter((k) => edit[k] !== undefined).map((k) => [k, edit[k] === null ? undefined : (TOGGLES[k] as (e: unknown, c: Chars, r: Range) => unknown)(edit[k], chars, span)])
  ) as RunStyle;
  for (let i = span.start; i < span.end; i++) {
    const next = { ...chars[i], ...resolved };
    STYLE_KEYS.forEach((k) => next[k] === undefined && delete next[k]);
    chars[i] = Object.keys(next).length ? next : null;
  }
  return runsOf(chars);
}

export function shiftRuns(runs: readonly TextRun[] | undefined, before: string, after: string): TextRun[] {
  const [a, b] = [codePoints(before), codePoints(after)];
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) {
    prefix++;
  }
  let suffix = 0;
  while (suffix < a.length - prefix && suffix < b.length - prefix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) {
    suffix++;
  }
  const old = charsOf(runs ?? [], a.length);
  const carried = prefix > 0 ? old[prefix - 1] : null;
  const inserted = Array.from({ length: b.length - prefix - suffix }, () => carried);
  return runsOf([...old.slice(0, prefix), ...inserted, ...old.slice(a.length - suffix)]);
}

export function segmentsOf(text: string, runs: readonly TextRun[] | undefined): Segment[] {
  const chars = codePoints(text);
  const segments: Segment[] = [];
  let at = 0;
  for (const run of normalRuns(runs, chars.length)) {
    if (run.start > at) {
      segments.push({ text: chars.slice(at, run.start).join(''), run: null });
    }
    segments.push({ text: chars.slice(run.start, run.end).join(''), run });
    at = run.end;
  }
  if (at < chars.length) {
    segments.push({ text: chars.slice(at).join(''), run: null });
  }
  return segments;
}

export const runAt = (runs: readonly TextRun[] | undefined, char: number): TextRun | null => (runs ?? []).find((r) => char >= r.start && char < r.end) ?? null;
