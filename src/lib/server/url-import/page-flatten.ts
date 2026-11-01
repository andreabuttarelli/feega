import type { RestNode, RestPaint } from '$lib/server/figma/rest-message';

type Box = { x: number; y: number; width: number; height: number };

const EPS = 0.5;
const MAX_PASSES = 8;
const MAX_NAME = 40;
const SECTION_ID = 'section:';
const WRAPPERS = new Set(['FRAME', 'GROUP']);
const SPACE_BETWEEN = 'SPACE_BETWEEN';
const ABSOLUTE = 'ABSOLUTE';

const ROLE_NAMES: Record<string, string> = {
  nav: 'Nav',
  header: 'Header',
  footer: 'Footer',
  main: 'Main',
  section: 'Section',
  article: 'Article',
  aside: 'Aside',
  button: 'Button',
  a: 'Link',
  ul: 'List',
  ol: 'List',
  li: 'Item',
  img: 'Image',
  picture: 'Image',
  image: 'Image',
  svg: 'Icon',
  icon: 'Icon',
  h1: 'Heading',
  h2: 'Heading',
  h3: 'Heading',
  h4: 'Heading',
  h5: 'Heading',
  h6: 'Heading',
  p: 'Paragraph',
  form: 'Form',
  input: 'Input',
  textarea: 'Input',
  select: 'Input',
  label: 'Label',
  figure: 'Figure',
  video: 'Video',
  canvas: 'Canvas',
  dialog: 'Dialog',
  table: 'Table'
};

const RAW_NAMES = new Set(['div', 'span', 'stack', 'row', 'column', 'g', 'path', 'circle', 'rect', 'line', 'polygon', 'polyline', 'ellipse', 'use', 'i', 'b', 'em', 'strong', 'small', 'body', 'html', 'fieldset', 'clip', 'group', 'frame', 'vector', 'background', 'outline', 'border top', 'border right', 'border bottom', 'border left']);

const LAYOUT_NAMES: Record<string, string> = { HORIZONTAL: 'Row', VERTICAL: 'Column' };

const TYPE_NAMES: Record<string, string> = { VECTOR: 'Vector', BOOLEAN_OPERATION: 'Vector', ELLIPSE: 'Vector', LINE: 'Line', RECTANGLE: 'Rectangle', GROUP: 'Group', FRAME: 'Frame' };

const DRAWN = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'ELLIPSE', 'LINE', 'STAR', 'REGULAR_POLYGON']);

const anchorable = (n: RestNode) => n.type === 'VECTOR' && Boolean(n.fillGeometry?.length);

const pathBound = (n: RestNode) => n.type === 'TEXT' || (DRAWN.has(n.type) && !anchorable(n));

const anchorOf = (n: RestNode) => `M 0 0 Z M ${boxOf(n)!.width} ${boxOf(n)!.height} Z`;

function anchored(n: RestNode): RestNode {
  if (!anchorable(n) || n.fillGeometry!.some((g) => g.path === anchorOf(n))) {
    return n;
  }
  return { ...n, fillGeometry: [...n.fillGeometry!, { path: anchorOf(n), windingRule: n.fillGeometry![0].windingRule }] };
}

const boxOf = (n: RestNode): Box | undefined => n.absoluteBoundingBox;

const shows = (paints: RestPaint[] | undefined) => (paints ?? []).some((p) => p.visible !== false && (p.opacity ?? 1) > 0 && (p.type !== 'SOLID' || (p.color?.a ?? 1) > 0));

type Effect = NonNullable<RestNode['effects']>[number];

const BLURS = new Set(['FOREGROUND_BLUR', 'LAYER_BLUR', 'BACKGROUND_BLUR']);

const effectShows = (e: Effect) => e.visible !== false && (BLURS.has(e.type) ? (e.radius ?? 0) > 0 : (e.color?.a ?? 1) > 0);

const affects = (n: RestNode) => (n.effects ?? []).some(effectShows);

const flowing = (k: RestNode) => k.layoutPositioning !== ABSOLUTE;

const sameBox = (a: Box | undefined, b: Box | undefined) => Boolean(a && b) && Math.abs(a!.x - b!.x) <= EPS && Math.abs(a!.y - b!.y) <= EPS && Math.abs(a!.width - b!.width) <= EPS && Math.abs(a!.height - b!.height) <= EPS;

const within = (b: Box | undefined, a: Box | undefined) => Boolean(a && b) && b!.x >= a!.x - EPS && b!.y >= a!.y - EPS && b!.x + b!.width <= a!.x + a!.width + EPS && b!.y + b!.height <= a!.y + a!.height + EPS;

const boundary = (n: RestNode) => n.type === 'INSTANCE' || n.type === 'COMPONENT' || Boolean(n.componentId) || n.use !== undefined || Boolean(n.codeComponent) || n.id.startsWith(SECTION_ID);

const looksLike = (n: RestNode) => shows(n.fills) || shows(n.strokes) || affects(n) || (n.opacity ?? 1) < 1 || Boolean(n.relativeTransform);

const descendants = (n: RestNode): RestNode[] => (n.children ?? []).flatMap((k) => [k, ...descendants(k)]);

const clipsSomething = (n: RestNode) => Boolean(n.clipsContent) && descendants(n).some((k) => !within(boxOf(k), boxOf(n)));

const bare = (n: RestNode) => WRAPPERS.has(n.type) && !boundary(n) && !looksLike(n) && !clipsSomething(n);

const zeroSized = (n: RestNode) => !boxOf(n) || boxOf(n)!.width < EPS || boxOf(n)!.height < EPS;

const INVISIBLE: { when: (n: RestNode) => boolean }[] = [
  { when: (n) => n.type === 'TEXT' && !(n.characters ?? '').trim() },
  { when: (n) => n.type !== 'TEXT' && !n.children?.length && !boundary(n) && zeroSized(n) && !shows(n.strokes) },
  { when: (n) => n.type !== 'TEXT' && !n.children?.length && !boundary(n) && !shows(n.fills) && !shows(n.strokes) && !affects(n) }
];

const invisible = (n: RestNode) => INVISIBLE.some((rule) => rule.when(n));

const raw = (name: string | undefined) => !name || RAW_NAMES.has(name.toLowerCase());

function adopted(child: RestNode, wrapper: RestNode): RestNode {
  const { layoutAlign, layoutGrow, layoutPositioning } = wrapper;
  const keepsName = child.type === 'TEXT' || !raw(child.name) || raw(wrapper.name);
  return { ...anchored(child), layoutAlign, layoutGrow, layoutPositioning, name: keepsName ? child.name : wrapper.name };
}

const only = (n: RestNode) => (n.children?.length === 1 ? n.children[0] : null);

const LAYOUT_KEYS = ['layoutMode', 'layoutWrap', 'itemSpacing', 'counterAxisSpacing', 'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom', 'primaryAxisAlignItems', 'counterAxisAlignItems', 'primaryAxisSizingMode', 'counterAxisSizingMode'] as const;

const layoutOf = (n: RestNode) => Object.fromEntries(LAYOUT_KEYS.map((key) => [key, n[key]]));

const round = (v: number) => Math.round(Math.max(0, v) * 100) / 100;

function grown(child: RestNode, wrapper: RestNode): RestNode {
  const [outer, inner] = [boxOf(wrapper)!, boxOf(child)!];
  const padding = child.layoutMode
    ? {
        paddingTop: round((child.paddingTop ?? 0) + inner.y - outer.y),
        paddingLeft: round((child.paddingLeft ?? 0) + inner.x - outer.x),
        paddingBottom: round((child.paddingBottom ?? 0) + outer.y + outer.height - inner.y - inner.height),
        paddingRight: round((child.paddingRight ?? 0) + outer.x + outer.width - inner.x - inner.width)
      }
    : {};
  return { ...adopted(child, wrapper), absoluteBoundingBox: outer, ...padding };
}

const growable = (k: RestNode) => {
  const c = only(k);
  return Boolean(c) && bare(k) && c!.type === 'FRAME' && bare(c!) && within(boxOf(c!), boxOf(k));
};

const ONE_LINE_SHARE = 1.5;
const FIXED_TEXT = 'NONE';

const oneLine = (t: RestNode) => t.type === 'TEXT' && flowing(t) && !(t.characters ?? '').includes('\n') && boxOf(t)!.height < (t.style?.lineHeightPx || boxOf(t)!.height) * ONE_LINE_SHARE;

const SLACK_PX = 1;

const H_ALIGNS: { align: (t: RestNode) => string; fits: (lead: number, trail: number) => boolean }[] = [
  { align: (t) => t.style?.textAlignHorizontal ?? 'LEFT', fits: (lead, trail) => lead <= SLACK_PX && trail <= SLACK_PX },
  { align: () => 'LEFT', fits: (lead) => lead <= SLACK_PX },
  { align: () => 'RIGHT', fits: (_, trail) => trail <= SLACK_PX },
  { align: () => 'CENTER', fits: (lead, trail) => Math.abs(lead - trail) <= SLACK_PX }
];

const offsets = (inner: Box, outer: Box) => ({
  left: inner.x - outer.x,
  right: outer.x + outer.width - inner.x - inner.width,
  top: inner.y - outer.y,
  bottom: outer.y + outer.height - inner.y - inner.height
});

function alignIn(t: RestNode, wrapper: RestNode): string | null {
  const o = offsets(boxOf(t)!, boxOf(wrapper)!);
  if (Math.min(o.left, o.right, o.top, o.bottom) < -EPS) {
    return null;
  }
  return H_ALIGNS.find((a) => a.fits(o.left, o.right))?.align(t) ?? null;
}

const pinned = (t: RestNode, wrapper: RestNode): RestNode => ({
  ...adopted(t, wrapper),
  absoluteBoundingBox: boxOf(wrapper),
  textAutoResize: FIXED_TEXT,
  style: { ...t.style, textAlignHorizontal: alignIn(t, wrapper)!, lineHeightUnit: 'PIXELS', lineHeightPx: round(boxOf(t)!.height + 2 * offsets(boxOf(t)!, boxOf(wrapper)!).top) }
});

type ChildRule = { name: string; applies: (k: RestNode, parent: RestNode, page: Box) => boolean; becomes: (k: RestNode) => RestNode[] };

const CHILD_RULES: ChildRule[] = [
  { name: 'empty', applies: (k, parent) => invisible(k) && (!parent.layoutMode || !flowing(k)), becomes: () => [] },
  { name: 'unwrap', applies: (k, parent) => Boolean(only(k)) && bare(k) && sameBox(boxOf(only(k)!), boxOf(k)) && (!pathBound(only(k)!) || !parent.layoutMode), becomes: (k) => [adopted(only(k)!, k)] },
  { name: 'label', applies: (k, parent, page) => Boolean(parent.layoutMode) && Boolean(only(k)) && bare(k) && oneLine(only(k)!) && within(boxOf(k), page) && alignIn(only(k)!, k) !== null, becomes: (k) => [pinned(only(k)!, k)] },
  { name: 'lift', applies: (k, parent) => Boolean(only(k)) && bare(k) && !parent.layoutMode && (!k.layoutMode || flowing(only(k)!)), becomes: (k) => [adopted(only(k)!, k)] },
  { name: 'grow', applies: growable, becomes: (k) => [grown(only(k)!, k)] }
];

function childFor(k: RestNode, parent: RestNode, page: Box): RestNode[] {
  return CHILD_RULES.find((rule) => rule.applies(k, parent, page))?.becomes(k) ?? [k];
}

const flowOf = (n: RestNode) => (n.children ?? []).filter(flowing);

function foldable(n: RestNode): boolean {
  const [w] = flowOf(n);
  const c = w && only(w);
  if (!n.layoutMode || flowOf(n).length !== 1 || !c || !bare(w) || !flowing(c) || pathBound(c)) {
    return false;
  }
  return within(boxOf(c), boxOf(n));
}

function folded(n: RestNode): RestNode {
  const [w] = flowOf(n);
  const c = only(w)!;
  const [outer, inner] = [boxOf(n)!, boxOf(c)!];
  return {
    ...n,
    paddingTop: round(inner.y - outer.y),
    paddingLeft: round(inner.x - outer.x),
    paddingBottom: round(outer.y + outer.height - inner.y - inner.height),
    paddingRight: round(outer.x + outer.width - inner.x - inner.width),
    primaryAxisAlignItems: 'MIN',
    counterAxisAlignItems: 'MIN',
    children: n.children!.map((k) => (k === w ? adopted(c, w) : k))
  };
}

const unpadded = (n: RestNode) => !n.paddingTop && !n.paddingRight && !n.paddingBottom && !n.paddingLeft;

const crossSpan = (n: RestNode) => (n.layoutMode === 'VERTICAL' ? boxOf(n)!.width - (n.paddingLeft ?? 0) - (n.paddingRight ?? 0) : boxOf(n)!.height - (n.paddingTop ?? 0) - (n.paddingBottom ?? 0));

const mergeable = (n: RestNode) => (w: RestNode) =>
  bare(w) &&
  flowing(w) &&
  w.layoutMode === n.layoutMode &&
  unpadded(w) &&
  Math.abs((w.itemSpacing ?? 0) - (n.itemSpacing ?? 0)) <= EPS &&
  w.primaryAxisAlignItems !== SPACE_BETWEEN &&
  w.counterAxisAlignItems === n.counterAxisAlignItems &&
  Math.abs(crossSpan(w) - crossSpan(n)) <= EPS &&
  (w.children ?? []).every(flowing);

function merged(n: RestNode): RestNode {
  const fits = mergeable(n);
  return { ...n, children: n.children!.flatMap((k) => (fits(k) ? k.children! : [k])) };
}

const HOSTS = new Set(['FRAME', 'INSTANCE', 'COMPONENT']);

const hoistable = (n: RestNode) => {
  const w = only(n);
  return HOSTS.has(n.type) && Boolean(w) && w!.type === 'FRAME' && bare(w!) && sameBox(boxOf(w!), boxOf(n));
};

const hoisted = (n: RestNode): RestNode => ({ ...n, ...layoutOf(only(n)!), children: only(n)!.children ?? [] });

const mergeKey = (n: RestNode) => (n.type === 'VECTOR' && n.fillGeometry?.length && !n.strokeGeometry?.length ? JSON.stringify([n.absoluteBoundingBox, n.fills, n.strokes, n.opacity, n.effects, n.layoutPositioning, n.fillGeometry.map((g) => g.windingRule ?? '')[0], new Set(n.fillGeometry.map((g) => g.windingRule ?? '')).size]) : null);

const twins = (a: RestNode | undefined, b: RestNode) => Boolean(a) && mergeKey(a!) !== null && mergeKey(a!) === mergeKey(b);

function vectorsJoined(n: RestNode): RestNode {
  const kids: RestNode[] = [];
  for (const k of n.children!) {
    const last = kids.at(-1);
    if (twins(last, k)) {
      kids[kids.length - 1] = { ...last!, fillGeometry: [...last!.fillGeometry!, ...k.fillGeometry!] };
      continue;
    }
    kids.push(k);
  }
  return { ...n, children: kids };
}

const hasTwins = (n: RestNode) => (n.children ?? []).some((k, i, all) => i > 0 && twins(all[i - 1], k));

type ParentRule = { name: string; applies: (n: RestNode) => boolean; becomes: (n: RestNode) => RestNode };

const PARENT_RULES: ParentRule[] = [
  { name: 'vectors', applies: hasTwins, becomes: vectorsJoined },
  { name: 'hoist', applies: hoistable, becomes: hoisted },
  { name: 'fold', applies: foldable, becomes: folded },
  { name: 'merge', applies: (n) => Boolean(n.layoutMode) && n.primaryAxisAlignItems !== SPACE_BETWEEN && (n.children ?? []).some(mergeable(n)), becomes: merged }
];

function simplified(n: RestNode, page: Box): RestNode {
  if (!n.children) {
    return n;
  }
  const own = { ...n, children: n.children.map((k) => simplified(k, page)) };
  const kids = { ...own, children: own.children.flatMap((k) => childFor(k, own, page)) };
  return PARENT_RULES.reduce<RestNode>((acc, rule) => (rule.applies(acc) ? rule.becomes(acc) : acc), kids);
}

const textsIn = (n: RestNode): RestNode[] => (n.type === 'TEXT' ? [n] : (n.children ?? []).flatMap(textsIn));

const leavesIn = (n: RestNode): RestNode[] => (n.children?.length ? n.children.flatMap(leavesIn) : [n]);


const ICON_MAX_PX = 64;

const small = (n: RestNode) => Boolean(boxOf(n)) && boxOf(n)!.width <= ICON_MAX_PX && boxOf(n)!.height <= ICON_MAX_PX;

const CONTENT_NAMES: { name: (n: RestNode) => string; when: (n: RestNode) => boolean }[] = [
  { name: (n) => textsIn(n)[0].characters!.trim().slice(0, MAX_NAME), when: (n) => textsIn(n).length === 1 },
  { name: () => 'Icon', when: (n) => Boolean(n.children?.length) && small(n) && leavesIn(n).every((l) => DRAWN.has(l.type)) },
  { name: () => 'Image', when: (n) => !n.children?.length && Boolean(n.fills?.some((p) => p.type === 'IMAGE')) },
  { name: (n) => LAYOUT_NAMES[n.layoutMode!], when: (n) => Boolean(LAYOUT_NAMES[n.layoutMode ?? '']) },
  { name: (n) => TYPE_NAMES[n.type] ?? 'Layer', when: () => true }
];

const contentName = (n: RestNode) => CONTENT_NAMES.find((rule) => rule.when(n))!.name(n);

const ROLE_PATTERNS: [RegExp, string][] = [[/(^|[-_ ])logo([-_ ]|$)/i, 'Logo']];

function ownName(n: RestNode): string {
  const tag = (n.name ?? '').toLowerCase();
  return ROLE_NAMES[tag] ?? ROLE_PATTERNS.find(([re]) => re.test(tag))?.[1] ?? (raw(n.name) ? contentName(n) : n.name!);
}

function named(n: RestNode, parentName: string | undefined): RestNode {
  const keeps = n.type === 'TEXT' || boundary(n);
  const first = keeps ? n.name : ownName(n);
  const name = !keeps && first === parentName ? contentName(n) : first;
  return { ...n, name, ...(n.children ? { children: n.children.map((k) => named(k, name)) } : {}) };
}

export type Layers = { count: number; depth: number };

export function layersOf(n: RestNode): Layers {
  const kids = (n.children ?? []).map(layersOf);
  return { count: 1 + kids.reduce((s, k) => s + k.count, 0), depth: 1 + Math.max(0, ...kids.map((k) => k.depth)) };
}

const shapeOf = (n: RestNode): string => `${n.type}${n.layoutMode ?? ''}(${(n.children ?? []).map(shapeOf).join(',')})`;

const instancesIn = (n: RestNode): RestNode[] => [...(n.componentId ? [n] : []), ...(n.children ?? []).flatMap(instancesIn)];

function replaced(n: RestNode, originals: Map<string, RestNode>): RestNode {
  return originals.get(n.id) ?? (n.children ? { ...n, children: n.children.map((k) => replaced(k, originals)) } : n);
}

function divergent(n: RestNode): Set<string> {
  const shapes = new Map<string, Set<string>>();
  for (const k of instancesIn(n)) {
    shapes.set(k.componentId!, (shapes.get(k.componentId!) ?? new Set()).add(shapeOf(k)));
  }
  return new Set([...shapes].flatMap(([id, seen]) => (seen.size > 1 ? [id] : [])));
}

function alike(out: RestNode, root: RestNode): RestNode {
  const before = instancesIn(root);
  let made = out;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const split = divergent(made);
    if (!split.size) {
      return made;
    }
    made = replaced(made, new Map(before.filter((k) => split.has(k.componentId!)).map((k) => [k.id, k])));
  }
  return made;
}

export function flattened(root: RestNode): RestNode {
  let out = root;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const next = simplified(out, boxOf(root)!);
    const done = layersOf(next).count === layersOf(out).count;
    out = next;
    if (done) {
      break;
    }
  }
  const kept = alike(out, root);
  return { ...kept, children: kept.children?.map((k) => named(k, kept.name)) };
}
