type Revised = { id: string; revision: number };

export function memoSources<F extends Revised, S>(read: (f: F) => Promise<S | null>): (f: F) => Promise<S | null> {
  const kept = new Map<string, { revision: number; source: S }>();
  return async (f) => {
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
}
