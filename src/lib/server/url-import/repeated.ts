import type { RestNode } from '$lib/server/figma/rest-message';

export type FoundVariant = { style: string; occurrences: number };
export type FoundComponent = { name: string; variants: FoundVariant[] };
export type Repeated = { root: RestNode; components: FoundComponent[] };

const MIN_SIDE = 16;
const MIN_PARTS = 2;
const MIN_OCCURRENCES = 2;
const BUTTON_HEIGHT = 64;
const LINK_HEIGHT = 48;
const HEADER_BOTTOM = 120;
const CANDIDATES = new Set(['FRAME', 'GROUP']);
const STYLE_VALUES = ['Primary', 'Secondary', 'Tertiary'];
const STYLE_PROP = 'Style';

type Seen = { node: RestNode; order: number; skeleton: string; parts: number; style: string };
type Facts = { tag: string; painted: boolean; texts: number; image: boolean; icon: boolean; height: number; y: number };
type Group = Seen[];
type Chosen = { name: string; variants: Group[] };

const NAMES: { name: string | ((f: Facts) => string); when: (f: Facts) => boolean }[] = [
  { name: 'Logo', when: (f) => !f.texts && (f.image || f.icon) },
  { name: 'Button', when: (f) => f.tag === 'button' || (f.painted && f.texts === 1 && !f.image && f.height <= BUTTON_HEIGHT) },
  { name: (f) => (f.y < HEADER_BOTTOM ? 'Nav link' : 'Link'), when: (f) => f.tag === 'a' && f.height <= LINK_HEIGHT },
  { name: 'List item', when: (f) => f.tag === 'li' },
  { name: 'Card', when: (f) => f.image && f.texts > 0 },
  { name: 'Feature card', when: (f) => f.icon && f.texts >= 2 },
  { name: 'Card', when: (f) => f.texts >= 2 },
  { name: 'Item', when: () => true }
];

const walk = (n: RestNode, visit: (n: RestNode) => void) => {
  visit(n);
  (n.children ?? []).forEach((c) => walk(c, visit));
};

function factsOf(n: RestNode): Facts {
  const facts: Facts = { tag: (n.name ?? '').toLowerCase(), painted: Boolean(n.fills?.length || n.strokes?.length), texts: 0, image: false, icon: false, height: n.absoluteBoundingBox?.height ?? 0, y: n.absoluteBoundingBox?.y ?? 0 };
  walk(n, (d) => {
    facts.texts += d.type === 'TEXT' ? 1 : 0;
    facts.image ||= Boolean(d.fills?.some((p) => p.type === 'IMAGE'));
    facts.icon ||= d.type === 'VECTOR';
  });
  return facts;
}

function nameOf(n: RestNode): string {
  const facts = factsOf(n);
  const rule = NAMES.find((r) => r.when(facts))!;
  return typeof rule.name === 'string' ? rule.name : rule.name(facts);
}

const leafOf = (n: RestNode) => `${n.type}${n.type === 'TEXT' ? `${n.style?.fontSize}/${n.style?.fontWeight}` : ''}${n.fills?.some((p) => p.type === 'IMAGE') ? 'i' : ''}`;

const styleOf = (n: RestNode) => JSON.stringify([n.fills, n.strokes, n.strokeWeight, n.cornerRadius, n.rectangleCornerRadii, n.effects, n.opacity]);

const drawn = (n: RestNode) => {
  const facts = factsOf(n);
  return facts.painted || facts.image || facts.icon;
};

const bigEnough = (n: RestNode) => (n.absoluteBoundingBox?.width ?? 0) >= MIN_SIDE && (n.absoluteBoundingBox?.height ?? 0) >= MIN_SIDE;

function seenOf(root: RestNode): { seen: Seen[]; parent: Map<string, string> } {
  const seen: Seen[] = [];
  const parent = new Map<string, string>();
  let order = 0;
  const visit = (n: RestNode): { skeleton: string; parts: number } => {
    const at = order++;
    const kids = (n.children ?? []).map((c) => {
      parent.set(c.id, n.id);
      return visit(c);
    });
    const skeleton = `${leafOf(n)}${n.layoutMode ?? ''}[${kids.map((k) => k.skeleton).join(',')}]`;
    const parts = 1 + kids.reduce((sum, k) => sum + k.parts, 0);
    if (n !== root && CANDIDATES.has(n.type) && parts >= MIN_PARTS && bigEnough(n) && drawn(n)) {
      seen.push({ node: n, order: at, skeleton, parts, style: styleOf(n) });
    }
    return { skeleton, parts };
  };
  visit(root);
  return { seen, parent };
}

function groupedBy<T>(items: T[], key: (t: T) => string): T[][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  }
  return [...groups.values()];
}

function variantsOf(sets: Seen[]): Group[] {
  const byStyle = groupedBy(sets, (s) => s.style);
  const repeated = byStyle.some((g) => g.length >= MIN_OCCURRENCES);
  return repeated ? byStyle.sort((a, b) => b.length - a.length) : [];
}

function chosenOf(seen: Seen[], parent: Map<string, string>): Chosen[] {
  const sets = groupedBy(seen, (s) => s.skeleton).sort((a, b) => b[0].parts - a[0].parts);
  const claimed = new Set<string>();
  const above = new Set<string>();
  const isFree = (s: Seen) => {
    for (let at: string | undefined = s.node.id; at; at = parent.get(at)) {
      if (claimed.has(at)) {
        return false;
      }
    }
    return !above.has(s.node.id);
  };
  const claim = (s: Seen) => {
    claimed.add(s.node.id);
    for (let at = parent.get(s.node.id); at; at = parent.get(at)) {
      above.add(at);
    }
  };
  return sets.flatMap((set) => {
    const variants = variantsOf(set.filter(isFree));
    if (variants.flat().length < MIN_OCCURRENCES) {
      return [];
    }
    variants.flat().forEach(claim);
    return [{ name: nameOf(variants[0][0].node), variants: variants.map((v) => v.sort((a, b) => a.order - b.order)) }];
  });
}

const styleValue = (index: number) => STYLE_VALUES[index] ?? `${STYLE_PROP} ${index + 1}`;

const flattened = (n: RestNode): RestNode => {
  const kids = (n.children ?? []).flatMap((c) => (c.type === 'GROUP' && !n.layoutMode ? (c.children ?? []).map(flattened) : [flattened(c)]));
  return n.children ? { ...n, children: kids } : n;
};

type Marking = { componentId: string; name: string };

function markingsOf(chosen: Chosen[]): Map<string, Marking> {
  const marks = new Map<string, Marking>();
  for (const { name, variants } of chosen) {
    variants.forEach((group, index) => {
      const main = group[0].node;
      const mainName = variants.length > 1 ? `${name} / ${STYLE_PROP}=${styleValue(index)}` : name;
      group.forEach((s, i) => marks.set(s.node.id, { componentId: main.id, name: i === 0 ? mainName : name }));
    });
  }
  return marks;
}

function marked(n: RestNode, marks: Map<string, Marking>): RestNode {
  const mark = marks.get(n.id);
  if (mark) {
    return { ...flattened(n), type: 'INSTANCE', ...mark };
  }
  return n.children ? { ...n, children: n.children.map((c) => marked(c, marks)) } : n;
}

function uniquelyNamed(chosen: Chosen[]): Chosen[] {
  const uses = new Map<string, number>();
  return chosen.map((c) => {
    const n = (uses.get(c.name) ?? 0) + 1;
    uses.set(c.name, n);
    return n === 1 ? c : { ...c, name: `${c.name} ${n}` };
  });
}

export function repeatedOf(root: RestNode): Repeated {
  const { seen, parent } = seenOf(root);
  const chosen = uniquelyNamed(chosenOf(seen, parent));
  return {
    root: marked(root, markingsOf(chosen)),
    components: chosen.map(({ name, variants }) => ({ name, variants: variants.map((g, i) => ({ style: variants.length > 1 ? styleValue(i) : '', occurrences: g.length })) }))
  };
}
