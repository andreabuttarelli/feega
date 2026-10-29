export function perDoc<D extends object, W, R>(compute: (doc: D, with_: W) => R): (doc: D, with_: W) => R {
  const held = new WeakMap<D, { with_: W; result: R }>();

  return (doc, with_) => {
    const known = held.get(doc);
    if (known && known.with_ === with_) {
      return known.result;
    }

    const result = compute(doc, with_);
    held.set(doc, { with_, result });
    return result;
  };
}
