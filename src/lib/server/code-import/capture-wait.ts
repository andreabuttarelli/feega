export const CAPTURE_BUDGET_MS = 150_000;
export const CAPTURE_DELAY_MAX_MS = 10_000;
export const DELAY_BUDGET_MS = CAPTURE_BUDGET_MS / 3;

export type CaptureDelay = { ms: number; routes: Record<string, number> };

export const NO_DELAY: CaptureDelay = { ms: 0, routes: {} };

const clamped = (raw: unknown): number | null => (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 ? Math.min(raw, CAPTURE_DELAY_MAX_MS) : null);

export function delayOf(raw: unknown): CaptureDelay {
  const ask = raw as { ms?: unknown; routes?: unknown } | null | undefined;
  const routes = Object.entries(typeof ask?.routes === 'object' && ask.routes ? ask.routes : {}).flatMap(([route, ms]) => {
    const kept = clamped(ms);
    return kept === null ? [] : [[route, kept] as const];
  });
  return { ms: clamped(ask?.ms) ?? 0, routes: Object.fromEntries(routes) };
}

export function delayFor(delay: CaptureDelay, route: string, pages: number): number {
  const each = Math.floor(DELAY_BUDGET_MS / Math.max(pages, 1));
  return Math.min(delay.routes[route] ?? delay.ms, each);
}
