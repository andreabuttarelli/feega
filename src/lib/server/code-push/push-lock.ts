export type PushLock = {
  acquire: (key: string) => Promise<boolean>;
  release: (key: string) => Promise<void>;
};

export function memoryLock(): PushLock {
  const held = new Set<string>();
  return {
    acquire: async (key) => {
      if (held.has(key)) {
        return false;
      }
      held.add(key);
      return true;
    },
    release: async (key) => {
      held.delete(key);
    }
  };
}
