export enum Rate {
  Smooth = 90,
  ProMotion = 120
}

const MS_PER_S = 1000;
const MAX_OVER_SHARE = 0.02;

export const budgetMs = (rate: Rate) => MS_PER_S / rate;

export const FRAME_BUDGET_MS = budgetMs(Rate.Smooth);

const round = (n: number) => Math.round(n * 10) / 10;

const at = (sorted: number[], share: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))] ?? 0;

export function budgetOf(gaps: number[], rate = Rate.Smooth) {
  const limit = budgetMs(rate);
  const sorted = [...gaps].sort((a, b) => a - b);
  const p95 = round(at(sorted, 0.95));
  const over = sorted.filter((g) => g > limit).length;
  const share = sorted.length ? over / sorted.length : 1;
  return { frames: sorted.length, p95, p99: round(at(sorted, 0.99)), worst: round(sorted.at(-1) ?? 0), over, overShare: round(share * 100) / 100, passed: sorted.length > 0 && p95 <= limit && share <= MAX_OVER_SHARE };
}
