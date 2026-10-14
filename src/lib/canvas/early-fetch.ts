type Ports<T> = { load: (url: string) => Promise<T>; now: () => number };

const FRESH_MS = 15_000;

export function earlyFetch<T>({ load, now }: Ports<T>) {
  const started = new Map<string, { at: number; result: Promise<T> }>();

  return {
    start(url: string) {
      const held = started.get(url);
      if (held && now() - held.at < FRESH_MS) {
        return;
      }
      const result = load(url);
      result.catch(() => undefined);
      started.set(url, { at: now(), result });
    },
    take(url: string): Promise<T> {
      const held = started.get(url);
      started.delete(url);
      return held && now() - held.at < FRESH_MS ? held.result : load(url);
    }
  };
}
