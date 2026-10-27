import type { Range } from './number-field';

const WEIGHT_KEYS: ReadonlySet<string> = new Set(['weight', 'fontWeight']);
const WEIGHT_STEP = 100;
const WEIGHT_MIN = 100;
const WEIGHT_MAX = 900;

export function steppedRange<R extends Range>(key: string, range: R): R {
  return WEIGHT_KEYS.has(key) ? { ...range, min: WEIGHT_MIN, max: WEIGHT_MAX, step: WEIGHT_STEP } : range;
}

export function snappedValue(key: string, value: number): number {
  if (!WEIGHT_KEYS.has(key)) {
    return value;
  }
  const snapped = Math.round(value / WEIGHT_STEP) * WEIGHT_STEP;
  return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, snapped));
}
