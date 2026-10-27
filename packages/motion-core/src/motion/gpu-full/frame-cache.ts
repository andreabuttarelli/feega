export type Run = { from: number; to: number };

type Entry<T> = { key: string; start: number; end: number; value: T; bytes: number };

export type FrameCache<T> = {
  get: (key: string, t: number) => T | null;
  put: (key: string, start: number, duration: number, value: T, bytes: number) => void;
  runs: (key: string) => Run[];
  clear: (key?: string) => void;
  bytes: () => number;
};

type Options<T> = { budget: number; onEvict?: (value: T) => void };

const TOUCHING_SECONDS = 1e-6;

const idOf = (key: string, start: number) => `${key}@${start}`;

export function createFrameCache<T>({ budget, onEvict = () => {} }: Options<T>): FrameCache<T> {
  const recency = new Map<string, Entry<T>>();
  const byKey = new Map<string, Entry<T>[]>();
  let used = 0;

  const spans = (key: string) => byKey.get(key) ?? [];

  const drop = (entry: Entry<T>) => {
    recency.delete(idOf(entry.key, entry.start));
    byKey.set(entry.key, spans(entry.key).filter((e) => e !== entry));
    used -= entry.bytes;
    onEvict(entry.value);
  };

  const find = (key: string, t: number) => spans(key).find((e) => t + TOUCHING_SECONDS >= e.start && t + TOUCHING_SECONDS < e.end);

  const get = (key: string, t: number) => {
    const entry = find(key, t);
    if (!entry) {
      return null;
    }
    const id = idOf(key, entry.start);
    recency.delete(id);
    recency.set(id, entry);
    return entry.value;
  };

  const put = (key: string, start: number, duration: number, value: T, bytes: number) => {
    const same = recency.get(idOf(key, start));
    if (same) {
      drop(same);
    }
    const entry: Entry<T> = { key, start, end: start + duration, value, bytes };
    recency.set(idOf(key, start), entry);
    byKey.set(key, [...spans(key), entry].sort((a, b) => a.start - b.start));
    used += bytes;
    while (used > budget) {
      drop(recency.values().next().value as Entry<T>);
    }
  };

  const runs = (key: string) =>
    spans(key).reduce<Run[]>((out, e) => {
      const last = out[out.length - 1];
      if (last && e.start <= last.to + TOUCHING_SECONDS) {
        last.to = Math.max(last.to, e.end);
        return out;
      }
      return [...out, { from: e.start, to: e.end }];
    }, []);

  const clear = (key?: string) => {
    const doomed = key === undefined ? [...recency.values()] : [...spans(key)];
    doomed.forEach(drop);
  };

  return { get, put, runs, clear, bytes: () => used };
}
