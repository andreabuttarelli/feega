type Later = (job: () => void) => void;

export function paintFirst<K, T>(later: Later, run: (key: K, input: T) => void) {
  const held = new Map<K, T>();

  const release = (key: K) => {
    if (!held.has(key)) {
      return;
    }
    const input = held.get(key) as T;
    held.delete(key);
    run(key, input);
  };

  return {
    now(key: K, input: T) {
      held.delete(key);
      run(key, input);
    },
    afterPaint(key: K, input: T) {
      const waiting = held.has(key);
      held.set(key, input);
      if (!waiting) {
        later(() => release(key));
      }
    }
  };
}
