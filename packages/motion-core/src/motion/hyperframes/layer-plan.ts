export enum PassKind {
  Dom = 'dom',
  Canvas = 'canvas',
  Grain = 'grain'
}

export type LayerFacts = { kind: PassKind; blend: string; backdrop: boolean };
export type Pass = { kind: PassKind; layers: number[]; blend: string };

export function planLayers(facts: LayerFacts[]): Pass[] {
  const dom = 'dom' as PassKind.Dom;
  const blends = new Set(['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity']);
  const maxDomPasses = 2;
  const flat: Pass[] = [{ kind: dom, layers: facts.map((_, i) => i), blend: 'normal' }];
  const alone = (f: LayerFacts | undefined) => Boolean(f && f.kind !== dom);

  const split = (all: LayerFacts[]): Pass[] | null => {
    const first = all.findIndex(alone);
    if (first < 0 || all.slice(first).some((f) => f.backdrop || !blends.has(f.blend))) {
      return null;
    }
    const passes: Pass[] = [];
    all.forEach((f, i) => {
      const last = passes[passes.length - 1];
      const own = alone(f) || (i > first && f.blend !== 'normal');
      if (!own && last?.kind === dom && last.blend === 'normal') {
        last.layers.push(i);
        return;
      }
      passes.push({ kind: f.kind, layers: [i], blend: i < first ? 'normal' : f.blend });
    });
    return passes.filter((p) => p.kind === dom).length > maxDomPasses ? null : passes;
  };

  const run = (from: number, step: number) => {
    let i = from;
    while (alone(facts[i])) {
      i += step;
    }
    return i;
  };
  const bottom = run(0, 1);
  const top = run(facts.length - 1, -1);
  const edges = facts.map((f, i) => (i < bottom || i > top ? f : { ...f, kind: dom }));
  return split(facts) ?? split(edges) ?? flat;
}
