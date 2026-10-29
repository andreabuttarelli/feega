import { Sizing } from './auto-layout';

export const MAX_FILL_WEIGHT = 12;
export const MAX_PERCENT = 100;

export type SizeEntry = { sizing: Sizing; value?: number };

type Reader = { pattern: RegExp; read: (n: number | undefined) => SizeEntry | null };

const inRange = (n: number, min: number, max: number) => n > min && n <= max;

const READERS: readonly Reader[] = [
  { pattern: /^hug$/i, read: () => ({ sizing: Sizing.Hug }) },
  { pattern: /^(?:fill(?:\s*[x×]?\s*(\d+(?:\.\d+)?))?|(\d+(?:\.\d+)?)\s*fr)$/i, read: (n = 1) => (inRange(n, 0, MAX_FILL_WEIGHT) ? { sizing: Sizing.Fill, value: n } : null) },
  { pattern: /^(\d+(?:\.\d+)?)\s*%$/, read: (n = 0) => (inRange(n, 0, MAX_PERCENT) ? { sizing: Sizing.Percent, value: n } : null) },
  { pattern: /^(\d+(?:\.\d+)?)\s*(?:px)?$/i, read: (n = 0) => ({ sizing: Sizing.Fixed, value: n }) }
];

export function parseSize(text: string): SizeEntry | null {
  const trimmed = text.trim();
  for (const { pattern, read } of READERS) {
    const match = pattern.exec(trimmed);
    if (!match) {
      continue;
    }
    const digits = match.slice(1).find((g) => g !== undefined);
    return read(digits === undefined ? undefined : Number(digits));
  }
  return null;
}

const WRITERS: Record<Sizing, (value: number) => string> = {
  [Sizing.Hug]: () => 'Hug',
  [Sizing.Fill]: (value) => `Fill ×${value}`,
  [Sizing.Percent]: (value) => `${value}%`,
  [Sizing.Fixed]: (value) => `${Math.round(value)}`
};

export const formatSize = (entry: SizeEntry): string => WRITERS[entry.sizing](entry.value ?? 1);
