export type Lru<V> = {
  get: (key: string) => V | undefined;
  set: (key: string, value: V, bytes: number) => void;
  drop: (key: string) => void;
  clear: () => void;
  readonly bytes: number;
};

export function createLru<V>(budget: number, release: (key: string, value: V) => void, inUse: (key: string) => boolean = () => false): Lru<V> {
  const entries = new Map<string, { value: V; bytes: number }>();
  let total = 0;

  function evict(keep: string) {
    for (const [key, e] of entries) {
      if (total <= budget) {
        return;
      }
      if (key === keep || inUse(key)) {
        continue;
      }
      entries.delete(key);
      total -= e.bytes;
      release(key, e.value);
    }
  }

  return {
    get(key) {
      const e = entries.get(key);
      if (!e) {
        return undefined;
      }
      entries.delete(key);
      entries.set(key, e);
      return e.value;
    },
    set(key, value, bytes) {
      const old = entries.get(key);
      if (old) {
        entries.delete(key);
        total -= old.bytes;
      }
      entries.set(key, { value, bytes });
      total += bytes;
      evict(key);
    },
    drop(key) {
      const e = entries.get(key);
      if (!e || inUse(key)) {
        return;
      }
      entries.delete(key);
      total -= e.bytes;
      release(key, e.value);
    },
    clear() {
      for (const [key, e] of entries) {
        release(key, e.value);
      }
      entries.clear();
      total = 0;
    },
    get bytes() {
      return total;
    }
  };
}
