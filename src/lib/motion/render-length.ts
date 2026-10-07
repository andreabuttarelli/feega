const FREE_SECONDS = 60;

export const RENDER_SECONDS: Record<string, number> = {
  free: FREE_SECONDS,
  go: FREE_SECONDS,
  starter: 120,
  pro: 180,
  scale: 180
};

export function renderSeconds(plan: string | null): number {
  return RENDER_SECONDS[plan ?? 'free'] ?? FREE_SECONDS;
}

export function lengthProblem(seconds: number, plan: string | null): string | null {
  const limit = renderSeconds(plan);
  return seconds > limit ? `your plan renders videos up to ${limit} s: shorten this one or upgrade` : null;
}
