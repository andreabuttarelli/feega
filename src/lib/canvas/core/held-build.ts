type Entry<H> = { same: unknown[]; made: Promise<H> };

const sameAs = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((v, i) => v === b[i]);

export function heldBuilds<S, H>(make: (source: S) => Promise<H>, release: (held: H) => void): { of: (id: string, same: unknown[], source: S) => Promise<H>; drop: (id: string) => void } {
  const held = new Map<string, Entry<H>>();

  const drop = (id: string) => {
    void held.get(id)?.made.then(release, () => {});
    held.delete(id);
  };

  const of = (id: string, same: unknown[], source: S) => {
    const now = held.get(id);
    if (now && sameAs(now.same, same)) {
      return now.made;
    }
    drop(id);

    const made = make(source);
    held.set(id, { same, made });
    made.catch(() => held.get(id)?.made === made && held.delete(id));
    return made;
  };

  return { of, drop };
}
