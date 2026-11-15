type Later = (job: () => void) => void;

export const QUIET_MS = 400;

export function paintFirst<K, T>(later: Later, run: (key: K, input: T) => void, quiet: Later = (job) => setTimeout(job, QUIET_MS)) {
  const held = new Map<K, T>();
  const turns = new Map<K, number>();

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
      turns.delete(key);
      run(key, input);
    },
    afterQuiet(key: K, input: T) {
      held.set(key, input);
      const turn = (turns.get(key) ?? 0) + 1;
      turns.set(key, turn);
      quiet(() => turns.get(key) === turn && later(() => release(key)));
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
