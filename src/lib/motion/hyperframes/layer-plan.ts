export enum PassKind {
  Dom = 'dom',
  Canvas = 'canvas'
}

export type LayerFacts = { canvas: boolean; blend: string; backdrop: boolean };
export type Pass = { kind: PassKind; layers: number[]; blend: string };

export function planLayers(facts: LayerFacts[]): Pass[] {
  const dom = 'dom' as PassKind.Dom;
  const drawn = 'canvas' as PassKind.Canvas;
  const blends = new Set(['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity']);
  const maxDomPasses = 2;
  const flat: Pass[] = [{ kind: dom, layers: facts.map((_, i) => i), blend: 'normal' }];
  const first = facts.findIndex((f) => f.canvas);
  if (first < 0) {
    return flat;
  }

  const above = facts.slice(first);
  if (above.some((f) => f.backdrop || !blends.has(f.blend))) {
    return flat;
  }

  const passes: Pass[] = [];
  facts.forEach((f, i) => {
    const last = passes[passes.length - 1];
    const own = f.canvas || (i > first && f.blend !== 'normal');
    if (!own && last?.kind === dom && last.blend === 'normal') {
      last.layers.push(i);
      return;
    }
    passes.push({ kind: f.canvas ? drawn : dom, layers: [i], blend: i < first ? 'normal' : f.blend });
  });
  return passes.filter((p) => p.kind === dom).length > maxDomPasses ? flat : passes;
}
