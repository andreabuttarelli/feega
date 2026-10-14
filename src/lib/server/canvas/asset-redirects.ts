const MS_PER_S = 1000;
const CAPACITY = 5000;

type Remembered = { location: string; expiresAt: number };

export type RedirectMemo = {
  recall(key: string): string | null;
  keep(key: string, location: string): void;
};

export function redirectMemo(ttlSeconds: number, now: () => number = Date.now): RedirectMemo {
  const entries = new Map<string, Remembered>();

  return {
    recall(key) {
      const entry = entries.get(key);
      if (!entry || entry.expiresAt <= now()) {
        entries.delete(key);
        return null;
      }
      return entry.location;
    },
    keep(key, location) {
      entries.delete(key);
      entries.set(key, { location, expiresAt: now() + ttlSeconds * MS_PER_S });
      if (entries.size <= CAPACITY) {
        return;
      }
      const oldest = entries.keys().next().value;
      if (oldest !== undefined) {
        entries.delete(oldest);
      }
    }
  };
}
