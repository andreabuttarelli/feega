export function latestOnly<K, T>(run: (key: K, input: T) => Promise<void>): (key: K, input: T) => void {
  const busy = new Set<K>();
  const waiting = new Map<K, T>();

  const start = (key: K, input: T) => {
    busy.add(key);
    void run(key, input)
      .catch(() => {})
      .finally(() => {
        busy.delete(key);
        if (!waiting.has(key)) {
          return;
        }
        const next = waiting.get(key) as T;
        waiting.delete(key);
        start(key, next);
      });
  };

  return (key, input) => {
    if (busy.has(key)) {
      waiting.set(key, input);
      return;
    }
    start(key, input);
  };
}
