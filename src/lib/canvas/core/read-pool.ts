type Waiting = { distance: () => number; start: () => void };

export type ReadPool = <T>(distance: () => number, task: (signal: AbortSignal) => Promise<T>) => Promise<T>;

export function readPool({ lanes, timeoutMs }: { lanes: number; timeoutMs: number }): ReadPool {
  let busy = 0;
  const waiting: Waiting[] = [];

  const next = () => {
    if (busy >= lanes || !waiting.length) {
      return;
    }
    const nearest = waiting.reduce((best, w) => (w.distance() < best.distance() ? w : best));
    waiting.splice(waiting.indexOf(nearest), 1);
    nearest.start();
  };

  return (distance, task) =>
    new Promise((resolve, reject) => {
      const start = () => {
        busy++;
        const stop = new AbortController();
        const timer = setTimeout(() => stop.abort(), timeoutMs);
        const timedOut = new Promise<never>((_, fail) => stop.signal.addEventListener('abort', () => fail(new Error(`custom component read timed out after ${timeoutMs} ms`))));
        Promise.race([task(stop.signal), timedOut])
          .then(resolve, reject)
          .finally(() => {
            clearTimeout(timer);
            stop.abort();
            busy--;
            next();
          });
      };
      waiting.push({ distance, start });
      next();
    });
}
