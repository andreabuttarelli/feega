type Ports<T> = { load: (url: string) => Promise<T>; now: () => number; landed?: (url: string, value: T) => void };

const FRESH_MS = 15_000;

type Held<T> = { at: number; result: Promise<T>; value?: T };

export function earlyFetch<T>({ load, now, landed }: Ports<T>) {
  const started = new Map<string, Held<T>>();
  const open = new Set<string>();
  const fresh = (held: Held<T> | undefined): held is Held<T> => !!held && now() - held.at < FRESH_MS;

  return {
    start(url: string) {
      if (open.has(url) || fresh(started.get(url))) {
        return;
      }
      const held: Held<T> = { at: now(), result: load(url) };
      held.result
        .then((value) => {
          held.value = value;
          landed?.(url, value);
        })
        .catch(() => undefined);
      started.set(url, held);
    },
    settled(url: string): T | undefined {
      const held = started.get(url);
      return fresh(held) ? held.value : undefined;
    },
    hold(url: string): () => void {
      open.add(url);
      return () => {
        open.delete(url);
        started.delete(url);
      };
    },
    take(url: string): Promise<T> {
      const held = started.get(url);
      started.delete(url);
      return fresh(held) ? held.result : load(url);
    }
  };
}
