import { z } from 'zod';
import { fillSchema, FillType, type Fill } from './fill/model';

const MIN_WEIGHT = 100;
const MAX_WEIGHT = 900;
const MAX_RUNS = 200;
export const BOLD = 700;

const MIN_SIZE = 0.005;
const MAX_SIZE = 1;
const MIN_TRACKING = -0.2;
const MAX_TRACKING = 1;
const MIN_LEADING = 0.6;
const MAX_LEADING = 3;

export const RUN_CASES = ['as-typed', 'upper', 'lower'] as const;
export type RunCase = (typeof RUN_CASES)[number];

export type GradientFill = Exclude<Fill, { type: FillType.Solid | FillType.Image }>;

const LINK_PROTOCOLS = /^(https?:|mailto:)/i;
const MAX_LINK = 2048;

const NOT_GRADIENT = new Set<FillType>([FillType.Solid, FillType.Image]);

const gradientSchema = fillSchema.refine((f) => !NOT_GRADIENT.has(f.type), 'a range takes a gradient: use color for a solid') as unknown as z.ZodType<GradientFill>;

const runStyleShape = {
  fill: gradientSchema.optional(),
  color: z.string().min(1).max(64).optional(),
  weight: z.number().int().min(MIN_WEIGHT).max(MAX_WEIGHT).optional(),
  italic: z.boolean().optional(),
  font: z.string().min(1).max(64).optional(),
  size: z.number().min(MIN_SIZE).max(MAX_SIZE).optional(),
  tracking: z.number().min(MIN_TRACKING).max(MAX_TRACKING).optional(),
  leading: z.number().min(MIN_LEADING).max(MAX_LEADING).optional(),
  underline: z.boolean().optional(),
  strike: z.boolean().optional(),
  textCase: z.enum(RUN_CASES).optional(),
  opacity: z.number().min(0).max(1).optional(),
  link: z.string().max(MAX_LINK).regex(LINK_PROTOCOLS, 'a link is http, https or mailto').optional()
};

export const runSchema = z.object({ start: z.number().int().min(0), end: z.number().int().min(1), ...runStyleShape }).strict();

export const runEditSchema = z.object(Object.fromEntries(Object.entries(runStyleShape).map(([k, v]) => [k, v.unwrap().nullable().optional()])) as { [K in keyof typeof runStyleShape]: z.ZodOptional<z.ZodNullable<ReturnType<(typeof runStyleShape)[K]['unwrap']>>> }).strict();

export const runsSchema = z.array(runSchema).max(MAX_RUNS).optional();

export type RunStyle = { fill?: GradientFill; color?: string; weight?: number; italic?: boolean; font?: string; size?: number; tracking?: number; leading?: number; underline?: boolean; strike?: boolean; textCase?: RunCase; opacity?: number; link?: string };
export type TextRun = { start: number; end: number } & RunStyle;
export type Range = { start: number; end: number };
export type Segment = { text: string; run: TextRun | null };

export enum RunToggle {
  Bold = 'bold',
  Italic = 'italic',
  Underline = 'underline',
  Strike = 'strike'
}

type Toggled = { weight: RunToggle.Bold; italic: RunToggle.Italic; underline: RunToggle.Underline; strike: RunToggle.Strike };

export type RunEdit = { [K in keyof RunStyle]?: RunStyle[K] | (K extends keyof Toggled ? Toggled[K] : never) | null };

export const STYLE_KEYS = ['fill', 'color', 'weight', 'italic', 'font', 'size', 'tracking', 'leading', 'underline', 'strike', 'textCase', 'opacity', 'link'] as const;

export type StyleKey = (typeof STYLE_KEYS)[number];

type Chars = (RunStyle | null)[];

const styleOf = (run: TextRun): RunStyle | null => {
  const style = Object.fromEntries(STYLE_KEYS.filter((k) => run[k] !== undefined).map((k) => [k, run[k]])) as RunStyle;
  return Object.keys(style).length ? style : null;
};

const sameValue = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

const sameStyle = (a: RunStyle | null, b: RunStyle | null) => STYLE_KEYS.every((k) => sameValue(a?.[k], b?.[k]));

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

const OTHER_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export function linkOf(raw: string): string | null | undefined {
  const typed = raw.trim();
  if (!typed) {
    return null;
  }
  if (LINK_PROTOCOLS.test(typed)) {
    return typed;
  }
  return OTHER_SCHEME.test(typed) ? undefined : `https://${typed}`;
}

export const codePoints = (text: string) => [...text];

export const codeIndex = (text: string, utf16: number) => [...text.slice(0, utf16)].length;

export const normalRuns = (runs: readonly TextRun[] | undefined, length: number): TextRun[] => runsOf(charsOf(runs ?? [], length));

const everyChar = (chars: Chars, range: Range, has: (s: RunStyle | null) => boolean) => chars.slice(range.start, range.end).every(has);

const flag = (key: 'italic' | 'underline' | 'strike', toggle: RunToggle) => (edit: unknown, chars: Chars, range: Range) => (edit === toggle ? (everyChar(chars, range, (s) => s?.[key] === true) ? undefined : true) : edit);

const plain = (edit: unknown) => edit;

const TOGGLES: Record<StyleKey, (edit: unknown, chars: Chars, range: Range) => unknown> = {
  fill: plain,
  color: plain,
  weight: (edit, chars, range) => (edit === RunToggle.Bold ? (everyChar(chars, range, (s) => (s?.weight ?? 0) >= BOLD) ? undefined : BOLD) : edit),
  italic: flag('italic', RunToggle.Italic),
  underline: flag('underline', RunToggle.Underline),
  strike: flag('strike', RunToggle.Strike),
  font: plain,
  size: plain,
  tracking: plain,
  leading: plain,
  textCase: plain,
  opacity: plain,
  link: plain
};

const REPLACES: Partial<Record<StyleKey, StyleKey>> = { fill: 'color', color: 'fill' };

export function styledRange(runs: readonly TextRun[] | undefined, range: Range, edit: RunEdit, length: number): TextRun[] {
  const chars = charsOf(runs ?? [], length);
  const span = { start: Math.max(0, range.start), end: Math.min(length, range.end) };
  const resolved = Object.fromEntries(
    STYLE_KEYS.filter((k) => edit[k] !== undefined).map((k) => [k, edit[k] === null ? undefined : TOGGLES[k](edit[k], chars, span)])
  ) as RunStyle;
  for (let i = span.start; i < span.end; i++) {
    const next = { ...chars[i], ...resolved };
    STYLE_KEYS.filter((k) => resolved[k] !== undefined && REPLACES[k]).forEach((k) => delete next[REPLACES[k]!]);
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

export const MIXED = 'mixed' as const;

export type RangeValues = { [K in StyleKey]: RunStyle[K] | typeof MIXED };

export function rangeValues(runs: readonly TextRun[] | undefined, range: Range, base: Required<Pick<RunStyle, StyleKey>> | RunStyle, length: number): RangeValues {
  const chars = charsOf(runs ?? [], length).slice(range.start, Math.max(range.end, range.start + 1));
  const valueAt = (k: StyleKey, c: RunStyle | null) => c?.[k] ?? base[k];
  return Object.fromEntries(
    STYLE_KEYS.map((k) => {
      const values = new Set(chars.map((c) => JSON.stringify(valueAt(k, c))));
      return [k, values.size > 1 ? MIXED : (chars.length ? valueAt(k, chars[0]) : base[k])];
    })
  ) as RangeValues;
}
