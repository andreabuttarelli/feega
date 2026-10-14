export const HISTOGRAM_EDGES_MS = [8.8, 12.5, 17.5, 25, 34, 50, 100] as const;

const WORST_SHARE = 0.95;
const MEDIAN_SHARE = 0.5;
const MS_PER_SECOND = 1000;

export type FrameStats = {
  rate: number;
  worst5Fps: number;
  p50: number;
  p95: number;
  max: number;
  histogram: number[];
};

const tenth = (n: number) => Math.round(n * 10) / 10;

function at(sorted: number[], share: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))] ?? 0;
}

function bucketOf(gap: number): number {
  const index = HISTOGRAM_EDGES_MS.findIndex((edge) => gap < edge);
  return index === -1 ? HISTOGRAM_EDGES_MS.length : index;
}

export function frameStats(gaps: number[]): FrameStats {
  const histogram = Array.from({ length: HISTOGRAM_EDGES_MS.length + 1 }, () => 0);
  if (!gaps.length) {
    return { rate: 0, worst5Fps: 0, p50: 0, p95: 0, max: 0, histogram };
  }

  for (const gap of gaps) {
    histogram[bucketOf(gap)] += 1;
  }

  const sorted = [...gaps].sort((a, b) => a - b);
  const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  const p95 = at(sorted, WORST_SHARE);
  return {
    rate: Math.round(MS_PER_SECOND / mean),
    worst5Fps: Math.round(MS_PER_SECOND / p95),
    p50: tenth(at(sorted, MEDIAN_SHARE)),
    p95: tenth(p95),
    max: tenth(sorted.at(-1)!),
    histogram
  };
}
