export type Pins<O> = {
  use: (url: string, owner: O) => void;
  drop: (owner: O) => void;
  owners: (url: string) => O[];
  pinned: (url: string, visible: (owner: O) => boolean) => boolean;
};

export function createPins<O>(): Pins<O> {
  const byUrl = new Map<string, Set<O>>();

  return {
    use(url, owner) {
      const set = byUrl.get(url) ?? new Set<O>();
      set.add(owner);
      byUrl.set(url, set);
    },
    drop(owner) {
      for (const [url, set] of byUrl) {
        set.delete(owner);
        if (!set.size) {
          byUrl.delete(url);
        }
      }
    },
    owners(url) {
      return [...(byUrl.get(url) ?? [])];
    },
    pinned(url, visible) {
      return [...(byUrl.get(url) ?? [])].some(visible);
    }
  };
}
