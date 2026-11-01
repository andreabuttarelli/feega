import { compOf, type MotionDoc, type MotionTrack } from '@feega/motion-core/motion/doc';
import { ActionKind, TransitionKind, TriggerKind, type Interaction } from '@feega/motion-core/motion/prototype/model';
import type { RestNode } from '$lib/server/figma/rest-message';
import { PatternKind, type PagePattern } from './page-patterns';

export const PATTERN_NAMES: Record<PatternKind, string> = {
  [PatternKind.Accordion]: 'Accordion',
  [PatternKind.Disclosure]: 'Disclosure',
  [PatternKind.Tabs]: 'Tabs',
  [PatternKind.Toggle]: 'Toggle',
  [PatternKind.Carousel]: 'Carousel'
};

export type PatternSet = { name: string; prop: string; initial: string };

type Named = PagePattern & { name: string };

const NAME_BREAKS = /[=,/]+/g;

const valueOf = (raw: string) => raw.replace(NAME_BREAKS, ' ').replace(/\s+/g, ' ').trim() || '-';

function named(patterns: readonly PagePattern[]): Named[] {
  const counts = new Map<PatternKind, number>();
  return patterns.map((p) => {
    const n = (counts.get(p.kind) ?? 0) + 1;
    counts.set(p.kind, n);
    return { ...p, name: `${PATTERN_NAMES[p.kind]} ${n}` };
  });
}

export const patternSets = (patterns: readonly PagePattern[]): PatternSet[] => named(patterns).map((p) => ({ name: p.name, prop: p.prop, initial: valueOf(p.initial) }));

const walk = (n: RestNode, visit: (n: RestNode) => void) => {
  visit(n);
  (n.children ?? []).forEach((c) => walk(c, visit));
};

const mapped = (n: RestNode, map: (n: RestNode) => RestNode[]): RestNode[] => map(n.children ? { ...n, children: n.children.flatMap((c) => mapped(c, map)) } : n);

const changeTo = (id: string, prop: string, go: string): Interaction => ({
  id: `go-${id}`,
  trigger: { kind: TriggerKind.Click },
  action: { kind: ActionKind.ChangeTo, variant: { [prop]: valueOf(go) } },
  transition: { kind: TransitionKind.Instant }
});

function wired(root: RestNode, prop: string): RestNode {
  return mapped(root, ({ go, pattern: _pattern, ...n }) => [go === undefined ? n : { ...n, behaviour: { ...n.behaviour, interactions: [changeTo(n.id, prop, go)] } }])[0];
}

function mainOf(root: RestNode, p: Named, state: string): RestNode {
  return { ...wired(root, p.prop), type: 'INSTANCE', componentId: root.id, name: `${p.name} / ${p.prop}=${valueOf(state)}` };
}

function setOf(node: RestNode, p: Named, stack: (n: RestNode) => RestNode): RestNode[] {
  const others = p.variants.map((v) => ({ ...mainOf(stack(v.root), p, v.state), collapsed: true, layoutPositioning: 'ABSOLUTE' }));
  return [mainOf(node, p, p.initial), ...others];
}

function firstRoots(root: RestNode): Map<number, RestNode> {
  const found = new Map<number, RestNode>();
  walk(root, (n) => {
    if (n.pattern !== undefined && !found.has(n.pattern)) {
      found.set(n.pattern, n);
    }
  });
  return found;
}

function claimedAround(marked: RestNode, held: ReadonlySet<string>): Set<string> {
  const claimed = new Set<string>();
  walk(marked, (n) => {
    if (!n.componentId) {
      return;
    }
    walk(n, (d) => {
      if (held.has(d.id)) {
        claimed.add(n.componentId!);
      }
    });
  });
  return claimed;
}

function unclaimed(marked: RestNode, bare: RestNode, held: ReadonlySet<string>): RestNode {
  const claimed = claimedAround(marked, held);
  if (!claimed.size) {
    return marked;
  }
  const before = new Map<string, RestNode>();
  walk(bare, (n) => before.set(n.id, n));
  return mapped(marked, (n) => [n.componentId && claimed.has(n.componentId) ? before.get(n.id) ?? n : n])[0];
}

export function withPatterns(root: RestNode, patterns: readonly PagePattern[], mark: (root: RestNode) => RestNode, stack: (n: RestNode) => RestNode): RestNode {
  const byIx = new Map(named(patterns).map((p) => [p.ix, p]));
  const roots = new Map([...firstRoots(root)].filter(([ix]) => byIx.has(ix)));
  if (!roots.size) {
    return mark(root);
  }
  const held = new Map([...roots].map(([ix, n]) => [n.id, { node: n, pattern: byIx.get(ix)! }]));
  const bare = mapped(root, ({ pattern: _pattern, ...n }) => [held.has(n.id) ? { ...n, type: 'INSTANCE', children: [] } : n])[0];
  const marked = unclaimed(mark(bare), bare, new Set(held.keys()));
  return mapped(marked, (n) => {
    const hold = held.get(n.id);
    return hold ? setOf(hold.node, hold.pattern, stack) : [n];
  })[0];
}

const withoutIn = (tracks: MotionTrack[], gone: ReadonlySet<string>): MotionTrack[] => tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => !gone.has(c.id)) }));

export function withoutCarriers(doc: MotionDoc, sets: readonly PatternSet[]): MotionDoc {
  const bySet = new Map(sets.map((s) => [s.name, s]));
  const others = new Set(
    Object.entries(doc.comps).flatMap(([id, c]) => {
      const set = c.component?.set ? bySet.get(c.component.set) : undefined;
      return set && c.component?.variant?.[set.prop] !== set.initial ? [id] : [];
    })
  );
  const tracks = [doc.tracks, ...Object.values(doc.comps).map((c) => c.tracks)];
  const gone = new Set(tracks.flatMap((list) => list.flatMap((t) => t.clips.filter((c) => c.hidden && others.has(compOf(c) ?? '')).map((c) => c.id))));
  if (!gone.size) {
    return doc;
  }
  return { ...doc, tracks: withoutIn(doc.tracks, gone), comps: Object.fromEntries(Object.entries(doc.comps).map(([id, c]) => [id, { ...c, tracks: withoutIn(c.tracks, gone) }])) };
}
