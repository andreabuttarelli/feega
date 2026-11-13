type Revised = { id: string; revision: number };

export function memoSources<F extends Revised, S>(read: (f: F) => Promise<S | null>): ((f: F) => Promise<S | null>) & { forget: (id: string) => void } {
  const kept = new Map<string, { revision: number; source: S }>();
  const memo = async (f: F) => {
    const held = kept.get(f.id);
    if (held && held.revision === f.revision) {
      return held.source;
    }
    const source = await read(f);
    if (source !== null) {
      kept.set(f.id, { revision: f.revision, source });
    }
    return source;
  };

  return Object.assign(memo, { forget: (id: string) => void kept.delete(id) });
}
