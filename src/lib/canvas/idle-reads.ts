export type CanvasPoll = { everyMs: number; readsPerRun: number };

const MS_PER_MIN = 60_000;

export const IDLE_CANVAS_READ_BUDGET_PER_MIN = 3;

export const CANVAS_POLLS = {
  calendar: { everyMs: 5 * MS_PER_MIN, readsPerRun: 4 }
} as const satisfies Record<string, CanvasPoll>;

export function idleReadsPerMinute<K extends string>(
  polls: Record<K, CanvasPoll>,
  instances: Record<K, number>
): number {
  return (Object.keys(polls) as K[]).reduce(
    (sum, key) => sum + instances[key] * polls[key].readsPerRun * (MS_PER_MIN / polls[key].everyMs),
    0
  );
}
