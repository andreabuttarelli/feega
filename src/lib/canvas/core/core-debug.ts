export enum Layer {
  Real = 'real',
  Previous = 'previous',
  Blocks = 'blocks',
  Placeholder = 'placeholder',
  None = 'none'
}

export enum Why {
  Drawn = 'drawn',
  LiveEditor = 'live editor',
  NotUploaded = 'not uploaded',
  Evicted = 'not resident (loading or evicted)',
  Offscreen = 'offscreen'
}

type Named = { group: string };

export type Candidates = { ready: Named | null; previous: Named | null; blocks: Named | null; placeholder: Named };

export type NodeFacts = { id: string; layer: Layer; why: Why; group: string | null };

const KINDS: readonly [Layer, keyof Candidates][] = [
  [Layer.Real, 'ready'],
  [Layer.Previous, 'previous'],
  [Layer.Blocks, 'blocks'],
  [Layer.Placeholder, 'placeholder']
];

export function layerOf(drawn: Named | null, candidates: Candidates): Layer {
  if (!drawn) {
    return Layer.None;
  }
  return KINDS.find(([, key]) => candidates[key]?.group === drawn.group)?.[0] ?? Layer.None;
}

export type Situation = { onScreen: boolean; hidden: boolean; drawn: Named | null; ready: boolean; candidates: Candidates };

export function factsOf(id: string, s: Situation): NodeFacts {
  const layer = layerOf(s.drawn, s.candidates);
  const group = s.drawn?.group ?? null;
  if (!s.onScreen) {
    return { id, layer, why: Why.Offscreen, group };
  }
  if (s.hidden) {
    return { id, layer, why: Why.LiveEditor, group };
  }
  if (layer === Layer.Real || layer === Layer.Previous) {
    return { id, layer, why: Why.Drawn, group };
  }
  return { id, layer, why: s.ready ? Why.NotUploaded : Why.Evicted, group };
}

export const undrawn = (facts: readonly NodeFacts[]): NodeFacts[] => facts.filter((f) => f.why !== Why.Drawn && f.why !== Why.Offscreen);

export const signatureOf = (facts: readonly NodeFacts[]): string => undrawn(facts).map((f) => `${f.id}:${f.layer}:${f.why}`).join('|');

export const describe = (f: NodeFacts): string => `${f.id.slice(0, 8)} layer=${f.layer} why=${f.why}${f.group ? ` group=${f.group.slice(0, 24)}` : ''}`;
