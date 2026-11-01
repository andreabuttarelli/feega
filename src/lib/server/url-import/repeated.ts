import type { RestNode, RestPaint } from '$lib/server/figma/rest-message';
import { factsOf, kindOf, Level, Merge, Prop, type Facts, type Kind } from './component-kinds';

export type FoundVariant = { style: string; occurrences: number };
export type FoundComponent = { name: string; variants: FoundVariant[] };
export type Repeated = { root: RestNode; components: FoundComponent[] };

const MIN_SIDE = 16;
const MIN_PARTS = 2;
const MIN_OCCURRENCES = 2;
const CANDIDATES = new Set(['FRAME', 'GROUP']);
const LEAVES = new Set(['TEXT', 'RECTANGLE']);
const WRAPPED_ID = ':instance';
const SIZE_TOLERANCE = 1.15;
const SAME_BOX_PX = 1;
const SIMILAR = 0.5;
const MAX_WIDTH_RATIO = 1.6;
const MAX_HEIGHT_RATIO = 2;
const COLOUR_STEPS = 16;
const SATURATION_STEPS = 10;
const VARIANT_PROP = 'Variant';
const FILLED_STYLES = ['Primary', 'Secondary', 'Tertiary'];
const SIZE_VALUES: Record<number, string[]> = { 2: ['Small', 'Large'], 3: ['Small', 'Medium', 'Large'], 4: ['Small', 'Medium', 'Large', 'XL'], 5: ['XS', 'Small', 'Medium', 'Large', 'XL'] };
const LAYOUT_CHILD_KEYS = ['layoutAlign', 'layoutGrow', 'layoutPositioning'] as const;

enum Look {
  Filled = 'filled',
  Outlined = 'outlined',
  Plain = 'plain'
}

const LOOK_NAMES: Record<Look, (index: number) => string> = {
  [Look.Filled]: (i) => FILLED_STYLES[i] ?? `Filled ${i + 1}`,
  [Look.Outlined]: (i) => (i ? `Outline ${i + 1}` : 'Outline'),
  [Look.Plain]: (i) => (i ? `Plain ${i + 1}` : 'Plain')
};

type Seen = { node: RestNode; order: number; skeleton: string; parts: number; style: string; size: number; facts: Facts; kind: Kind };
type Group = Seen[];
type Chosen = { name: string; kind: Kind; variants: Group[] };
type Tree = { seen: Seen[]; parent: Map<string, string>; byId: Map<string, RestNode> };

const leafOf = (n: RestNode) => `${n.type}${n.type === 'TEXT' ? `${n.style?.fontSize}/${n.style?.fontWeight}` : ''}${n.fills?.some((p) => p.type === 'IMAGE') ? 'i' : ''}`;

const lookOf = (f: Facts) => (f.filled ? Look.Filled : f.outlined ? Look.Outlined : Look.Plain);

const visible = (p: RestPaint) => p.visible !== false && (p.opacity ?? 1) > 0 && (p.type !== 'SOLID' || (p.color?.a ?? 1) > 0);

const step = (v: number | undefined) => Math.round((v ?? 0) * COLOUR_STEPS);

const paintKey = (p: RestPaint | undefined) => (p?.type === 'SOLID' ? [p.color?.r, p.color?.g, p.color?.b, (p.color?.a ?? 1) * (p.opacity ?? 1)].map(step).join('.') : (p?.type ?? ''));

const STYLES: Record<Level, (n: RestNode, f: Facts) => string> = {
  [Level.Atom]: (n, f) => `${lookOf(f)}|${paintKey(n.fills?.find(visible))}|${paintKey(n.strokes?.find(visible))}|${f.radius >= f.height / 2 - 1}`,
  [Level.Molecule]: (n, f) => `${lookOf(f)}|${JSON.stringify([n.fills, n.strokes, n.strokeWeight, n.cornerRadius, n.rectangleCornerRadii, n.effects, n.opacity])}`
};

const ownPaint = (n: RestNode) => Boolean(n.fills?.length || n.strokes?.length);

const drawn = (n: RestNode, f: Facts) => ownPaint(n) || f.images > 0 || f.vectors > 0;

const bigEnough = (n: RestNode) => (n.absoluteBoundingBox?.width ?? 0) >= MIN_SIDE && (n.absoluteBoundingBox?.height ?? 0) >= MIN_SIDE;

const onPage = (f: Facts) => f.x >= 0 && f.x + f.width <= f.pageWidth + SAME_BOX_PX;

function candidate(n: RestNode, parts: number, facts: Facts, kind: Kind): boolean {
  if (!bigEnough(n) || !onPage(facts)) {
    return false;
  }
  if (LEAVES.has(n.type)) {
    return kind.leaf;
  }
  return CANDIDATES.has(n.type) && parts >= MIN_PARTS && (drawn(n, facts) || kind.level === Level.Atom || kind.alone(facts));
}

function treeOf(root: RestNode): Tree {
  const seen: Seen[] = [];
  const parent = new Map<string, string>();
  const byId = new Map<string, RestNode>();
  const pageWidth = root.absoluteBoundingBox?.width ?? 0;
  let order = 0;
  const visit = (n: RestNode): { skeleton: string; parts: number; facts: Facts } => {
    const at = order++;
    byId.set(n.id, n);
    const kids = (n.children ?? []).map((c) => {
      parent.set(c.id, n.id);
      return visit(c);
    });
    const skeleton = `${leafOf(n)}${n.layoutMode ?? ''}[${kids.map((k) => k.skeleton).join(',')}]`;
    const parts = 1 + kids.reduce((sum, k) => sum + k.parts, 0);
    const facts = factsOf(n, kids.map((k) => k.facts), pageWidth);
    const kind = kindOf(facts);
    if (n !== root && candidate(n, parts, facts, kind)) {
      seen.push({ node: n, order: at, skeleton: `${kind.name}|${skeleton}`, parts, style: STYLES[kind.level](n, facts), size: facts.height, facts, kind });
    }
    return { skeleton, parts, facts };
  };
  visit(root);
  return { seen, parent, byId };
}

function groupedBy<T>(items: T[], key: (t: T) => string): T[][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  }
  return [...groups.values()];
}

function sizeSteps(heights: number[]): Map<number, number> {
  const steps = new Map<number, number>();
  let [index, start] = [-1, -Infinity];
  for (const h of [...new Set(heights)].sort((a, b) => a - b)) {
    if (h > start * SIZE_TOLERANCE) {
      [index, start] = [index + 1, h];
    }
    steps.set(h, index);
  }
  return steps;
}

function variantsOf(sets: Seen[]): Group[] {
  const byStyle = groupedBy(sets, (s) => s.style);
  const repeated = byStyle.some((g) => g.length >= MIN_OCCURRENCES);
  if (!repeated && !sets.some((s) => s.kind.alone(s.facts))) {
    return [];
  }
  const sorted = byStyle.sort((a, b) => b.length - a.length);
  if (!sets[0]?.kind.sized) {
    return sorted;
  }
  const steps = sizeSteps(sets.map((s) => s.size));
  return sorted.flatMap((g) => groupedBy(g, (s) => String(steps.get(s.size))));
}

const sameBox = (a: RestNode, b: RestNode) => {
  const [x, y] = [a.absoluteBoundingBox, b.absoluteBoundingBox];
  return Boolean(x && y) && Math.abs(x!.x - y!.x) <= SAME_BOX_PX && Math.abs(x!.y - y!.y) <= SAME_BOX_PX && Math.abs(x!.width - y!.width) <= SAME_BOX_PX && Math.abs(x!.height - y!.height) <= SAME_BOX_PX;
};

function chosenOf({ seen, parent, byId }: Tree): Chosen[] {
  const sets = groupedBy(seen, (s) => s.skeleton).sort((a, b) => b[0].parts - a[0].parts || a[0].order - b[0].order);
  const claimed = new Map<string, Kind>();
  const isFree = (s: Seen) => {
    for (let at = parent.get(s.node.id); at; at = parent.get(at)) {
      const outer = claimed.get(at);
      if (!outer) {
        continue;
      }
      if (!s.kind.nests || outer === s.kind || (s.kind.level === Level.Atom ? outer.level === Level.Atom : !(ownPaint(s.node) || s.kind.paintless)) || sameBox(byId.get(at)!, s.node)) {
        return false;
      }
    }
    return true;
  };
  return sets.flatMap((set) => {
    const variants = variantsOf(set.filter(isFree));
    if (!variants.length) {
      return [];
    }
    variants.flat().forEach((s) => claimed.set(s.node.id, s.kind));
    return [{ name: set[0].kind.name, kind: set[0].kind, variants: variants.map((v) => v.sort((a, b) => a.order - b.order)) }];
  });
}

function leavesOf(n: RestNode): Set<string> {
  const leaves = new Set<string>();
  const walk = (at: RestNode) => (at.children?.length ? at.children.forEach(walk) : leaves.add(leafOf(at)));
  walk(n);
  return leaves;
}

function similarity(a: Set<string>, b: Set<string>): number {
  const shared = [...a].filter((p) => b.has(p)).length;
  return shared / (a.size + b.size - shared || 1);
}

const ratio = (a: number, b: number) => Math.max(a, b) / Math.max(1, Math.min(a, b));

function sized(a: RestNode, b: RestNode): boolean {
  const [x, y] = [a.absoluteBoundingBox!, b.absoluteBoundingBox!];
  return ratio(x.width, y.width) <= MAX_WIDTH_RATIO && ratio(x.height, y.height) <= MAX_HEIGHT_RATIO;
}

const alike = (a: RestNode, b: RestNode, leaves: (n: RestNode) => Set<string>) => sized(a, b) && similarity(leaves(a), leaves(b)) >= SIMILAR;

const molecular = (c: Chosen) => c.kind.level === Level.Molecule;

function mergedOf(chosen: Chosen[], parent: Map<string, string>): Chosen[] {
  const memo = new Map<RestNode, Set<string>>();
  const leaves = (n: RestNode) => memo.get(n) ?? memo.set(n, leavesOf(n)).get(n)!;
  const grand = (n: RestNode) => parent.get(parent.get(n.id) ?? '');
  const siblings = (a: Seen, b: Seen) => parent.get(a.node.id) === parent.get(b.node.id) || grand(a.node) === grand(b.node);
  const joins = (m: Chosen, c: Chosen) => {
    const [a, b] = [m.variants[0][0], c.variants[0][0]];
    if (m.name === c.name) {
      return m.kind.merge === Merge.ByName || alike(a.node, b.node, leaves);
    }
    return molecular(m) && molecular(c) && a.style === b.style && siblings(a, b) && sized(a.node, b.node);
  };
  const merged: Chosen[] = [];
  for (const c of chosen) {
    const into = merged.find((m) => joins(m, c));
    if (into) {
      into.variants.push(...c.variants);
      continue;
    }
    merged.push({ ...c, variants: [...c.variants] });
  }
  return merged.map((m) => ({ ...m, ...mostOf(m.variants), variants: m.variants.sort((a, b) => a[0].order - b[0].order) }));
}

function mostOf(variants: Group[]): { name: string; kind: Kind } {
  const counts = groupedBy(variants.flat(), (s) => s.kind.name).sort((a, b) => b.length - a.length);
  return { name: counts[0][0].kind.name, kind: counts[0][0].kind };
}

const TAG_LIKE = /^[a-z0-9-]*$/;
const MAX_LABEL_WORDS = 3;
const MAX_LABEL = 24;
const NUMBERED = /\s\d+$/;
const FILE_NAME = /\/([A-Za-z][A-Za-z-_ ]*[A-Za-z])(?:[-_][a-z0-9]{0,3})?\.(svg|png|webp|jpe?g|avif)(\?|$)/;
const NO_LABEL = new Set(['image']);

const spelled = (raw: string) => raw.replace(/[-_]+/g, ' ');

const capitalised = (raw: string) => raw.charAt(0).toUpperCase() + raw.slice(1);

const descendants = (n: RestNode): RestNode[] => (n.children ?? []).flatMap((c) => [c, ...descendants(c)]);

function labelled(raw: string | undefined): string | null {
  const words = (raw ?? '').replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  const label = words.join(' ');
  const fits = words.length <= MAX_LABEL_WORDS && label.length <= MAX_LABEL && !NUMBERED.test(label);
  return label && fits && !TAG_LIKE.test(raw ?? '') && !NO_LABEL.has(label.toLowerCase()) ? label : null;
}

const LABELS: ((n: RestNode) => string | null)[] = [
  (n) => labelled(n.name),
  (n) => {
    const texts = descendants(n).filter((d) => d.type === 'TEXT');
    return texts.length === 1 ? labelled(texts[0].characters) : null;
  },
  (n) => labelled(descendants(n).find((d) => d.fills?.some((p) => p.type === 'IMAGE'))?.name),
  (n) => {
    const ref = [n, ...descendants(n)].flatMap((d) => (d.fills ?? []).flatMap((p) => (p.imageRef ? [p.imageRef] : [])))[0];
    const file = ref?.match(FILE_NAME)?.[1];
    return file ? labelled(capitalised(spelled(file))) : null;
  }
];

const labelOf = (n: RestNode): string | null => LABELS.reduce<string | null>((found, rule) => found ?? rule(n), null);

function sectionOf(rootId: string, tree: Tree, id: string): string | null {
  let at = id;
  for (let up = tree.parent.get(at); up && up !== rootId; up = tree.parent.get(at)) {
    at = up;
  }
  return at === id ? null : labelled(tree.byId.get(at)?.name);
}

function uniquelyNamed(chosen: Chosen[], rootId: string, tree: Tree): Chosen[] {
  const count = new Map<string, number>();
  chosen.forEach((c) => count.set(c.name, (count.get(c.name) ?? 0) + 1));
  const taken = new Set<string>();
  const uses = new Map<string, number>();
  return chosen.map((c) => {
    const n = (uses.get(c.name) ?? 0) + 1;
    uses.set(c.name, n);
    const main = c.variants[0][0].node;
    const qualifiers = count.get(c.name) === 1 ? [] : [sectionOf(rootId, tree, main.id), labelOf(main)].flatMap((q) => (q ? [`${q} ${c.name}`] : []));
    const name = [...qualifiers, n === 1 ? c.name : `${c.name} ${n}`].find((candidate) => !taken.has(candidate))!;
    taken.add(name);
    return name === c.name ? c : { ...c, name };
  });
}

const saturationOf = (n: RestNode) => {
  const c = n.fills?.find(visible)?.color;
  return c ? Math.round((Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b)) * SATURATION_STEPS) : 0;
};

function styleValues(variants: Group[]): Map<string, string> {
  const uses = groupedBy(variants, (g) => g[0].style).map((gs) => ({ style: gs[0][0].style, look: lookOf(gs[0][0].facts), saturation: saturationOf(gs[0][0].node), count: gs.reduce((s, g) => s + g.length, 0), order: gs[0][0].order }));
  const ranked = (list: typeof uses) => list.sort((a, b) => b.saturation - a.saturation || b.count - a.count || a.order - b.order);
  return new Map(groupedBy(uses, (u) => u.look).flatMap((list) => ranked(list).map((u, i) => [u.style, LOOK_NAMES[u.look](i)] as const)));
}

function sizeValues(variants: Group[]): (g: Group) => string {
  const steps = sizeSteps(variants.map((g) => g[0].size));
  const count = new Set(steps.values()).size;
  return (g) => {
    const at = steps.get(g[0].size)!;
    return SIZE_VALUES[count]?.[at] ?? `${Prop.Size} ${at + 1}`;
  };
}

function iconAt(n: RestNode): string {
  const flat: RestNode[] = [];
  const walk = (at: RestNode) => {
    flat.push(at);
    (at.children ?? []).forEach(walk);
  };
  walk(n);
  const icon = flat.find((d) => d.type === 'VECTOR' || d.name === 'icon');
  const text = flat.find((d) => d.type === 'TEXT');
  if (!icon) {
    return 'None';
  }
  if (!text) {
    return 'Only';
  }
  return icon.absoluteBoundingBox!.x < text.absoluteBoundingBox!.x ? 'Leading' : 'Trailing';
}

type Values = (variants: Group[]) => (g: Group) => string;

const PROPS: Record<Prop, Values> = {
  [Prop.Style]: (variants) => {
    const names = styleValues(variants);
    return (g) => names.get(g[0].style)!;
  },
  [Prop.Size]: sizeValues,
  [Prop.Icon]: () => (g) => iconAt(g[0].node),
  [Prop.Image]: () => (g) => (g[0].facts.images ? 'On' : 'Off'),
  [Prop.Items]: () => (g) => String(g[0].facts.texts)
};

function shapeValues(variants: Group[]): string[] {
  const labels = variants.map((g) => labelOf(g[0].node));
  const once = (label: string | null) => label !== null && labels.filter((l) => l === label).length === 1;
  return labels.map((label, i) => (once(label) ? label! : String(i + 1)));
}

function variantNames(kind: Kind, variants: Group[]): Map<Group, string> {
  const props = kind.props.flatMap((prop) => {
    const value = PROPS[prop](variants);
    return new Set(variants.map(value)).size > 1 ? [[prop, value] as const] : [];
  });
  const named = variants.map((g) => props.map(([prop, value]) => `${prop}=${value(g)}`));
  const unique = new Set(named.map((n) => n.join(', '))).size === variants.length;
  const shapes = shapeValues(variants);
  const pairs = unique ? named : named.map((n, i) => [...n, `${VARIANT_PROP}=${shapes[i]}`]);
  return new Map(variants.map((g, i) => [g, pairs[i].join(', ')]));
}

const flattened = (n: RestNode): RestNode => {
  const kids = (n.children ?? []).flatMap((c) => (c.type === 'GROUP' && !n.layoutMode ? (c.children ?? []).map(flattened) : [flattened(c)]));
  return n.children ? { ...n, children: kids } : n;
};

type Marking = { componentId: string; name: string };

const instanceId = (n: RestNode) => (LEAVES.has(n.type) ? `${n.id}${WRAPPED_ID}` : n.id);

function markingsOf(chosen: Chosen[], names: Map<Chosen, Map<Group, string>>): Map<string, Marking> {
  const marks = new Map<string, Marking>();
  for (const c of chosen) {
    c.variants.forEach((group) => {
      const variant = names.get(c)!.get(group);
      const mainName = variant ? `${c.name} / ${variant}` : c.name;
      group.forEach((s, i) => marks.set(s.node.id, { componentId: instanceId(group[0].node), name: i === 0 ? mainName : c.name }));
    });
  }
  return marks;
}

function wrapped(n: RestNode, mark: Marking): RestNode {
  const layout = Object.fromEntries(LAYOUT_CHILD_KEYS.flatMap((key) => (n[key] === undefined ? [] : [[key, n[key]]])));
  const inner = Object.fromEntries(Object.entries(n).filter(([key]) => !(LAYOUT_CHILD_KEYS as readonly string[]).includes(key))) as RestNode;
  return { id: instanceId(n), type: 'INSTANCE', ...mark, absoluteBoundingBox: n.absoluteBoundingBox, fills: [], clipsContent: false, ...layout, children: [inner] };
}

function marked(n: RestNode, marks: Map<string, Marking>): RestNode {
  const self = n.children ? { ...n, children: n.children.map((c) => marked(c, marks)) } : n;
  const mark = marks.get(n.id);
  if (!mark) {
    return self;
  }
  return LEAVES.has(n.type) ? wrapped(self, mark) : { ...flattened(self), type: 'INSTANCE', ...mark };
}

export function repeatedOf(root: RestNode): Repeated {
  const tree = treeOf(root);
  const chosen = uniquelyNamed(mergedOf(chosenOf(tree), tree.parent), root.id, tree);
  const names = new Map(chosen.map((c) => [c, variantNames(c.kind, c.variants)]));
  return {
    root: marked(root, markingsOf(chosen, names)),
    components: chosen.map((c) => ({ name: c.name, variants: c.variants.map((g) => ({ style: names.get(c)!.get(g) ?? '', occurrences: g.length })) }))
  };
}
