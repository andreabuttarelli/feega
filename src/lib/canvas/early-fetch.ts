type Ports<T> = { load: (url: string) => Promise<T>; now: () => number };

const FRESH_MS = 15_000;

type Held<T> = { at: number; result: Promise<T>; value?: T };

export function earlyFetch<T>({ load, now }: Ports<T>) {
  const started = new Map<string, Held<T>>();
  const fresh = (held: Held<T> | undefined): held is Held<T> => !!held && now() - held.at < FRESH_MS;

  return {
    start(url: string) {
      if (fresh(started.get(url))) {
        return;
      }
      const held: Held<T> = { at: now(), result: load(url) };
      held.result.then((value) => (held.value = value)).catch(() => undefined);
      started.set(url, held);
    },
    settled(url: string): T | undefined {
      const held = started.get(url);
      return fresh(held) ? held.value : undefined;
    },
    take(url: string): Promise<T> {
      const held = started.get(url);
      started.delete(url);
      return fresh(held) ? held.result : load(url);
    }
  };
}
