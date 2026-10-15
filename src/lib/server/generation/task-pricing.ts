export type TaskPriceLine = { inputs: Record<string, string>; usd: number; method: string };

export type TaskPricing = { lines: TaskPriceLine[] };

export const PER_RUN_METHODS: ReadonlySet<string> = new Set(['cpr', 'cpo']);

export const PER_RUN = 'cpr';

export function isTaskPricing(pricing: unknown): pricing is TaskPricing {
  return Boolean(pricing && typeof pricing === 'object' && Array.isArray((pricing as TaskPricing).lines));
}

export function taskUsdFor(pricing: unknown, inputs: Record<string, unknown>): number | null {
  if (!isTaskPricing(pricing)) {
    return null;
  }
  const line = pricing.lines.find((l) => Object.entries(l.inputs).every(([k, v]) => String(inputs[k] ?? '') === v));
  return line && PER_RUN_METHODS.has(line.method) && line.usd > 0 ? line.usd : null;
}
