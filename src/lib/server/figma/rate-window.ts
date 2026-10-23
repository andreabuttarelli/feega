export type RateWindow = { allow: (key: string, now?: number) => boolean };

export function rateWindow(rule: { limit: number; windowMs: number }): RateWindow {
  const hits = new Map<string, number[]>();

  return {
    allow: (key, now = Date.now()) => {
      const recent = (hits.get(key) ?? []).filter((at) => now - at < rule.windowMs);
      if (recent.length >= rule.limit) {
        hits.set(key, recent);
        return false;
      }
      hits.set(key, [...recent, now]);
      return true;
    }
  };
}
