import { Background, compOf, DEFAULT_VARIANT, type MotionClip, type MotionDoc, type MotionTrack } from '../doc';
import { clipRadii, clipsContent } from '../surface';
import type { BrandTokens } from '../brand';
import { parseProps, type ComponentId } from '../components';
import { childrenInOrder, compBounds } from '../layout/resolve';
import { Sizing } from '../layout/auto-layout';
import { DEFAULT_LAYOUT_ITEM } from '../layout/model';
import { isText } from '../layout/text-extent';
import { segmentsOf, type TextRun } from '../text-runs';
import { shapeMarkup, type ShapeLook } from '../shape/render';
import { resolveColor, FEEGA_TOKENS } from '../brand';
import { ShapeKind } from '../shape/schema';
import { pivotBox, type Size } from '../parent';
import type { Box } from '../layout';
import { kebab, NameBook } from './naming';
import { literal, NodeKind, type Attr, type Bound, type CodeNode, type ComponentSpec, type ElementNode, type PageSpec, type SetSpec, type Rule, type StyleBind } from './ir';
import { absoluteRules, containerRules, flowItemRules, isFlowChild, px, Shape } from './place';
import { backgroundRules, borderRules, effectRules, radiusRules, typeRules, type Painter } from './paint';
import { ColourRole, TokenBook } from './tokens';
import { animationOf, timelineOf, type Timeline } from './animate';
import { planComponents, PropKey, READINGS, specsOf, type Binding, type ComponentPlan } from './instances';

export type BuildInput = { doc: MotionDoc; name: string; assets: Record<string, string>; brand: BrandTokens | null };

type Shared = {
  doc: MotionDoc;
  tokens: TokenBook;
  plans: Map<string, ComponentPlan>;
  built: Map<string, ComponentSpec>;
  assets: Map<string, string | null>;
  urls: Record<string, string>;
  brand: BrandTokens | null;
  notes: Set<string>;
  h1: { taken: boolean };
  content: Map<string, Box>;
  timeline: Timeline;
};

type Scope = {
  shared: Shared;
  space: Size;
  clips: MotionClip[];
  rank: Map<string, number>;
  names: NameBook;
  plan: ComponentPlan | null;
  uses: Set<string>;
  painter: Painter;
  rootId: string | null;
  open: string[];
  boxOf: (clip: MotionClip) => Box;
  timeline: Timeline;
};

const SEMANTIC_CONTAINERS: readonly [RegExp, string][] = [
  [/\b(card|tier|plan)\b/i, 'article'],
  [/\bnav(igation|bar)?\b/i, 'nav'],
  [/\bheader\b/i, 'header'],
  [/\bfooter\b/i, 'footer'],
  [/\b(hero|section|features?|pricing|testimonials?|faq|cta|logos)\b/i, 'section'],
];

const INSTANCE_TAGS: readonly [RegExp, string, Attr[]][] = [
  [/\b(button|btn|cta)\b/i, 'button', [{ name: 'type', value: literal('button') }]],
  [/\blink\b/i, 'a', [{ name: 'href', value: literal('#') }]]
];

const HEADINGS: readonly { min: number; tag: string }[] = [
  { min: 44, tag: 'h1' },
  { min: 30, tag: 'h2' },
  { min: 18, tag: 'h3' }
];

const HEADING_WEIGHT = 500;

const INLINE_ONLY: ReadonlySet<string> = new Set(['button', 'a']);

const PLAIN_TEXT_IN: ReadonlySet<string> = new Set(['nav', 'footer']);

const TEXT_BY_NAME: readonly [RegExp, string][] = [[/\bquote\b/i, 'blockquote']];

const COMPONENT_HEADING = 'h3';

const PARAGRAPH = 'p';
const INLINE = 'span';
const STRONG_WEIGHT = 600;
const SVG_SHAPES: ReadonlySet<string> = new Set([ShapeKind.Path, ShapeKind.Vector, ShapeKind.Polygon, ShapeKind.Star, ShapeKind.Line]);
const SKIPPED: ReadonlySet<ComponentId> = new Set(['Audio', 'Adjustment', 'Light']);

const tagFor = (name: string, table: readonly [RegExp, string][], fallback: string) => table.find(([re]) => re.test(name))?.[1] ?? fallback;

const visibleAt = (clip: MotionClip, frame: number) => !clip.hidden && clip.from <= frame && frame < clip.from + clip.durationInFrames;

function rankOf(tracks: readonly MotionTrack[]): Map<string, number> {
  const rank = new Map<string, number>();
  [...tracks].reverse().forEach((t, ti) => (t.clips as MotionClip[]).forEach((c, ci) => rank.set(c.id, ti * 1000 + ci)));
  return rank;
}

function childrenOf(clip: MotionClip | null, scope: Scope): MotionClip[] {
  const parentId = clip?.id ?? null;
  const kids = scope.clips.filter((c) => (c.parent ?? null) === parentId && !SKIPPED.has(c.component));
  if (clip?.autoLayout) {
    return childrenInOrder(scope.clips, clip as MotionClip & { autoLayout: NonNullable<MotionClip['autoLayout']> }).filter((c) => kids.includes(c));
  }
  return [...kids].sort((a, b) => (scope.rank.get(a.id) ?? 0) - (scope.rank.get(b.id) ?? 0));
}

const layerName = (clip: MotionClip) => clip.name || clip.component;

const bindingsOf = (clip: MotionClip, scope: Scope): Binding[] => scope.plan?.bindings.get(clip.id) ?? [];

const bound = (clip: MotionClip, key: PropKey, scope: Scope) => bindingsOf(clip, scope).find((b) => b.key === key)?.spec.name;

function shapeOf(clip: MotionClip, scope: Scope): Shape {
  if (isText(clip.component)) {
    return Shape.Text;
  }
  return childrenOf(clip, scope).length || clip.autoLayout ? Shape.Container : Shape.Leaf;
}

function placement(clip: MotionClip, parent: MotionClip | null, scope: Scope): Rule[] {
  if (clip.id === scope.rootId) {
    return [];
  }
  const placed = { clip, shape: shapeOf(clip, scope), box: scope.boxOf(clip) };
  if (parent && isFlowChild(clip, parent)) {
    return flowItemRules(clip.component === 'Precomp' ? { ...placed, clip: hugged(clip) } : placed, parent.autoLayout!);
  }
  const parentBox = parent ? scope.boxOf(parent) : { left: 0, top: 0, ...scope.space };
  return absoluteRules(placed, parentBox);
}

const FIXED_TO_HUG = (sizing: Sizing) => (sizing === Sizing.Fixed ? Sizing.Hug : sizing);

function hugged(clip: MotionClip): MotionClip {
  const item = clip.layoutItem ?? DEFAULT_LAYOUT_ITEM;
  return { ...clip, layoutItem: { ...item, width: FIXED_TO_HUG(item.width), height: FIXED_TO_HUG(item.height) } };
}

const hasAbsoluteChild = (clip: MotionClip | null, kids: MotionClip[]) => kids.some((k) => !isFlowChild(k, clip));

function frameRules(clip: MotionClip | null, kids: MotionClip[], scope: Scope): Rule[] {
  const flow = clip?.autoLayout ? containerRules(clip.autoLayout, scope.shared.tokens) : [];
  const relative: Rule[] = hasAbsoluteChild(clip, kids) ? [['position', 'relative']] : [];
  const clipped: Rule[] = clip?.clipContent ? [['overflow', 'hidden']] : [];
  return [...relative, ...flow, ...clipped];
}

function sized(rules: Rule[], clip: MotionClip, kids: MotionClip[], scope: Scope): Rule[] {
  if (clip.autoLayout || !kids.length) {
    return rules;
  }
  const box = scope.boxOf(clip);
  const has = (p: string) => rules.some(([q]) => q === p || q === `min-${p}`);
  return [...rules.filter(([p]) => p !== 'min-height'), ...(has('width') ? [] : [['width', px(box.width)] as Rule]), ['height', px(box.height)]];
}

function noteDropped(clip: MotionClip, dropped: string[], scope: Scope) {
  for (const kind of dropped) {
    scope.shared.notes.add(`${layerName(clip)}: the ${kind} effect has no CSS equivalent and was left out.`);
  }
}

function element(tag: string, clip: MotionClip, rules: Rule[], scope: Scope, extra: Partial<ElementNode> = {}): ElementNode {
  const effects = effectRules(clip);
  noteDropped(clip, effects.dropped, scope);
  const shownBy = bound(clip, PropKey.Hidden, scope);
  const animation = animated(clip, scope);
  return { kind: NodeKind.Element, tag, clipId: clip.id, className: scope.names.unique(kebab(layerName(clip))), rules: [...rules, ...effects.rules], attrs: [], children: [], styleBinds: [], ...(shownBy ? { shownBy } : {}), ...(animation ? { animation } : {}), ...extra };
}

const animated = (clip: MotionClip, scope: Scope) => animationOf(clip, { timeline: scope.timeline, space: scope.space, notes: scope.shared.notes, label: layerName(clip) });

function styleBinds(clip: MotionClip, scope: Scope): StyleBind[] {
  return bindingsOf(clip, scope).flatMap((b) => (READINGS[b.key].css ? [{ property: READINGS[b.key].css!, prop: b.spec.name }] : []));
}

function boxNode(clip: MotionClip, parent: MotionClip | null, scope: Scope, tagOverride?: string): ElementNode {
  const kids = childrenOf(clip, scope);
  const box = scope.boxOf(clip);
  const root = clip.id === scope.rootId;
  const semantic = kids.length ? tagFor(layerName(clip), SEMANTIC_CONTAINERS, 'div') : 'div';
  const tag = tagOverride ?? (scope.open.includes(semantic) ? 'div' : semantic);
  const paint = clip.component === 'Shape' ? [...backgroundRules(clip, scope.painter, root && !scope.plan ? ColourRole.Page : ColourRole.Fill), ...borderRules(clip, scope.painter), ...radiusRules(clip, box, scope.painter)] : [];
  const framed = [...placement(clip, parent, scope), ...frameRules(clip, kids, scope), ...paint];
  const rules = root ? (clip.autoLayout || !kids.length ? framed : [...framed, ['min-height', px(box.height)] as Rule]) : sized(framed, clip, kids, scope);
  const node = element(tag, clip, rules, scope, { styleBinds: styleBinds(clip, scope) });
  scope.open.push(tag);
  node.children = kids.flatMap((k) => nodeOf(k, clip, scope, tag) ?? []);
  scope.open.pop();
  return node;
}

function headingTag(clip: MotionClip, sizePx: number, scope: Scope): string {
  const weighty = clip.component === 'Title' || Number(clip.props.weight ?? 400) >= HEADING_WEIGHT;
  const heading = (weighty ? HEADINGS.find((h) => sizePx >= h.min)?.tag : null) ?? PARAGRAPH;
  if (scope.plan) {
    return clip.id === scope.rootId || heading === PARAGRAPH ? PARAGRAPH : COMPONENT_HEADING;
  }
  if (heading !== 'h1') {
    return heading;
  }
  if (scope.shared.h1.taken) {
    return 'h2';
  }
  scope.shared.h1.taken = true;
  return 'h1';
}

function textChildren(text: string): CodeNode[] {
  return text.split('\n').flatMap((line, i) => [...(i ? [{ kind: NodeKind.Break } as CodeNode] : []), ...(line ? [{ kind: NodeKind.Text, value: literal(line) } as CodeNode] : [])]);
}

function runNode(text: string, run: TextRun | null, scope: Scope): CodeNode[] {
  if (!run) {
    return textChildren(text);
  }
  const inline = (tag: string, attrs: Attr[] = []): ElementNode => ({ kind: NodeKind.Element, tag, className: '', rules: [], attrs, children: textChildren(text), styleBinds: [] });
  if (run.link) {
    return [inline('a', [{ name: 'href', value: literal(run.link) }])];
  }
  if ((run.weight ?? 0) >= STRONG_WEIGHT) {
    return [inline('strong')];
  }
  if (run.italic) {
    return [inline('em')];
  }
  if (run.color) {
    const span = inline(INLINE);
    span.className = scope.names.unique('highlight');
    span.rules = [['color', scope.shared.tokens.colour(run.color, ColourRole.Text)]];
    return [span];
  }
  return textChildren(text);
}

function wholeLink(text: string, runs: TextRun[] | undefined): string | null {
  const only = runs?.length === 1 ? runs[0] : null;
  return only?.link && only.start === 0 && only.end >= [...text].length ? only.link : null;
}

function textTag(clip: MotionClip, at: { link: string | null; parentTag: string; sizePx: number }, scope: Scope): string {
  if (INLINE_ONLY.has(at.parentTag)) {
    return INLINE;
  }
  if (at.link) {
    return 'a';
  }
  const named = tagFor(layerName(clip), TEXT_BY_NAME, '');
  if (named) {
    return named;
  }
  if (PLAIN_TEXT_IN.has(at.parentTag) || scope.open.some((t) => PLAIN_TEXT_IN.has(t))) {
    return at.parentTag === 'nav' ? INLINE : PARAGRAPH;
  }
  return clip.component === 'Kicker' ? PARAGRAPH : headingTag(clip, at.sizePx, scope);
}

function textNode(clip: MotionClip, parent: MotionClip | null, scope: Scope, parentTag: string): ElementNode {
  const text = String(clip.props.text ?? clip.props.title ?? '');
  const runs = clip.props.runs as TextRun[] | undefined;
  const prop = bound(clip, PropKey.Text, scope);
  const sizePx = Number(clip.props.size ?? 0) * scope.painter.unit;
  const link = prop ? null : wholeLink(text, runs);
  const tag = textTag(clip, { link, parentTag, sizePx }, scope);
  const caption: Rule[] = clip.component === 'Caption' ? [['background-color', scope.shared.tokens.colour(String(clip.props.background ?? '#111111'), ColourRole.Fill)]] : [];
  const node = element(tag, clip, [...placement(clip, parent, scope), ...typeRules(clip, scope.painter, Boolean(prop)), ...caption], scope, { styleBinds: styleBinds(clip, scope) });
  node.attrs = link ? [{ name: 'href', value: literal(link) }] : [];
  node.children = prop ? [{ kind: NodeKind.Text, value: { prop } }] : link ? textChildren(text) : segmentsOf(text, runs).flatMap((s) => runNode(s.text, s.run, scope));
  return node;
}

function assetUrl(id: string | null | undefined, scope: Scope, fallbackName: string): string {
  const shared = scope.shared;
  if (!id) {
    return shared.brand?.logoUrl ?? `/assets/${kebab(fallbackName)}.svg`;
  }
  const url = shared.urls[id] ?? null;
  shared.assets.set(id, url);
  return url ?? `/assets/${id}`;
}

const MEDIA_TAG: Partial<Record<ComponentId, string>> = { Image: 'img', Logo: 'img', Video: 'video' };

const VIDEO_ATTRS: Attr[] = ['autoplay', 'muted', 'loop', 'playsinline'].map((name) => ({ name, value: literal('') }));

function mediaNode(clip: MotionClip, parent: MotionClip | null, scope: Scope): ElementNode {
  const tag = MEDIA_TAG[clip.component] ?? 'img';
  const prop = bound(clip, PropKey.Image, scope);
  const src: Bound = prop ? { prop } : literal(assetUrl(clip.props.assetId as string | null, scope, layerName(clip)));
  const fit = String(clip.props.fit ?? (clip.component === 'Logo' ? 'contain' : 'cover'));
  const rules: Rule[] = [...placement(clip, parent, scope), ['object-fit', fit], ['display', 'block']];
  const node = element(tag, clip, rules, scope);
  node.attrs = tag === 'video' ? [{ name: 'src', value: src }, ...VIDEO_ATTRS] : [{ name: 'src', value: src }, { name: 'alt', value: literal(clip.component === 'Logo' ? `${scope.shared.brand?.name ?? layerName(clip)} logo` : layerName(clip)) }];
  return node;
}

function svgNode(clip: MotionClip, parent: MotionClip | null, scope: Scope): CodeNode {
  const box = scope.boxOf(clip);
  const brand = scope.shared.brand ?? FEEGA_TOKENS;
  const size = { w: box.width, h: box.height };
  const verdict = parseProps('Shape', clip.props);
  const look = (verdict.ok ? verdict.props : clip.props) as unknown as ShapeLook;
  const markup = shapeMarkup(look, { id: kebab(layerName(clip)), size, unit: scope.painter.unit, time: 0, color: (v) => resolveColor(v, brand), asset: (id) => (id ? assetUrl(id, scope, 'image') : null) });
  const effects = effectRules(clip);
  noteDropped(clip, effects.dropped, scope);
  const shownBy = bound(clip, PropKey.Hidden, scope);
  const animation = animated(clip, scope);
  return { ...(animation ? { animation } : {}), kind: NodeKind.Svg, clipId: clip.id, className: scope.names.unique(kebab(layerName(clip))), rules: [...placement(clip, parent, scope), ...effects.rules], width: Math.round(box.width), height: Math.round(box.height), markup, ...(shownBy ? { shownBy } : {}) };
}

function useNode(clip: MotionClip, parent: MotionClip | null, scope: Scope): CodeNode | null {
  const plan = scope.shared.plans.get(compOf(clip)!);
  if (!plan) {
    return null;
  }
  ensureComponent(plan, scope.shared);
  scope.uses.add(plan.set?.name ?? plan.name);
  if (Object.keys(clip.keyframes).length) {
    scope.shared.notes.add(`${layerName(clip)}: animation on a component instance is not exported; animate the layers inside the component.`);
  }
  const forwards = scope.plan?.forwards.get(clip.id) ?? [];
  const forwarded = new Set(forwards.map((f) => f.name));
  const values = [...(plan.values.get(clip.id) ?? new Map<string, string | boolean>()).entries()].filter(([name]) => !forwarded.has(name));
  const shownBy = bound(clip, PropKey.Hidden, scope);
  return {
    kind: NodeKind.Use,
    clipId: clip.id,
    component: plan.name,
    ...(plan.set ? { set: { name: plan.set.name, variant: Object.entries(plan.set.variant).filter(([, v]) => v !== DEFAULT_VARIANT).map(([name, value]) => ({ name, value })) } } : {}),
    className: scope.names.unique(kebab(layerName(clip))),
    rules: placement(clip, parent, scope),
    props: values.map(([name, value]) => ({ name, value })),
    forwards,
    ...(shownBy ? { shownBy } : {})
  };
}

function nodeOf(clip: MotionClip, parent: MotionClip | null, scope: Scope, parentTag: string): CodeNode | null {
  if (isText(clip.component)) {
    return textNode(clip, parent, scope, parentTag);
  }
  if (MEDIA_TAG[clip.component]) {
    return mediaNode(clip, parent, scope);
  }
  if (clip.component === 'Precomp') {
    if (clip.props.scene) {
      scope.shared.notes.add(`${layerName(clip)}: a linked frame is not exported; export that frame on its own.`);
      return null;
    }
    return useNode(clip, parent, scope);
  }
  if (clip.component === 'Shape' && SVG_SHAPES.has(String(clip.props.shape)) && !childrenOf(clip, scope).length) {
    return svgNode(clip, parent, scope);
  }
  if (clip.component === 'Shape' || clip.component === 'Null') {
    return boxNode(clip, parent, scope);
  }
  if (clip.component !== 'BrandBackground') {
    scope.shared.notes.add(`${layerName(clip)}: ${clip.component} layers have no static HTML equivalent and were left out.`);
  }
  return null;
}

function scopeOf(shared: Shared, tracks: readonly MotionTrack[], space: Size, plan: ComponentPlan | null, frame: number, timeline: Timeline): Scope {
  const clips = tracks.flatMap((t) => t.clips as MotionClip[]).filter((c) => visibleAt(c, frame));
  const painter: Painter = {
    tokens: shared.tokens,
    unit: Math.min(space.width, space.height),
    asset: (id) => (id ? (shared.urls[id] ?? `/assets/${id}`) : ''),
    colourVar: (clip, key) => clip.bind?.[key]?.split('/').at(-1)
  };
  const boxOf = (clip: MotionClip): Box => {
    const content = clip.component === 'Precomp' ? shared.content.get(compOf(clip) ?? '') : undefined;
    if (!content) {
      return pivotBox(clip.props, space);
    }
    const dx = (clip.transform.x ?? 0) * space.width;
    const dy = (clip.transform.y ?? 0) * space.height;
    return { ...content, left: content.left + dx, top: content.top + dy };
  };
  return { shared, space, clips, rank: rankOf(tracks), names: new NameBook(), plan, uses: new Set(), painter, rootId: null, open: [], boxOf, timeline };
}

const HIDDEN: Rule[] = [['overflow', 'hidden']];

function pageCut(doc: MotionDoc): Rule[] {
  const radii = clipRadii(doc);
  const side = Math.min(doc.width, doc.height);
  const rounded: Rule[] = radii ? [['border-radius', radii.map((r) => px(r * side)).join(' ')]] : [];
  return [...(clipsContent(doc) ? HIDDEN : []), ...rounded];
}

function rootOf(scope: Scope, tag: string, own: Rule[], framed: Rule[]): ElementNode {
  const top = childrenOf(null, scope);
  const visual = top.filter((c) => c.component !== 'BrandBackground');
  const sole = visual.length === 1 ? visual[0] : null;
  if (sole && sole.component !== 'Precomp') {
    scope.rootId = sole.id;
    const container = sole.component === 'Shape' || sole.component === 'Null';
    const root = container ? boxNode(sole, null, scope, tag) : (nodeOf(sole, null, scope, tag) as ElementNode | null);
    if (root && root.kind === NodeKind.Element) {
      root.rules = [...own, ...root.rules];
      return root;
    }
  }
  const cut = scope.plan ? HIDDEN : pageCut(scope.shared.doc);
  const rules: Rule[] = [['position', 'relative'], ...own, ...framed, ['min-height', px(scope.space.height)], ...cut];
  const children = top.flatMap((c) => nodeOf(c, null, scope, tag) ?? []);
  return { kind: NodeKind.Element, tag, className: '', rules, attrs: [], children, styleBinds: [] };
}

function ensureComponent(plan: ComponentPlan, shared: Shared) {
  if (shared.built.has(plan.compId)) {
    return;
  }
  const space = plan.comp.frame ?? { width: shared.doc.width, height: shared.doc.height };
  const scope = scopeOf(shared, plan.comp.tracks, space, plan, 0, { ...shared.timeline, start: 0, length: plan.comp.durationInFrames });
  const content = shared.content.get(plan.compId);
  scope.names.unique(plan.block);
  const label = plan.comp.component?.name ?? plan.comp.name;
  const instanceTag = INSTANCE_TAGS.find(([re]) => re.test(label));
  const [, tag, attrs] = instanceTag ?? [null, tagFor(label, SEMANTIC_CONTAINERS, 'div'), []];
  shared.built.set(plan.compId, { name: plan.name, props: [], root: { kind: NodeKind.Element, tag, className: plan.block, rules: [], attrs: [], children: [], styleBinds: [] }, uses: [] });
  const root = rootOf(scope, tag, [], [['width', px(content?.width ?? space.width)]]);
  root.className = plan.block;
  root.attrs = [...attrs, ...root.attrs];
  if (instanceTag) {
    root.tag = tag;
  }
  const props = specsOf(plan);
  shared.built.set(plan.compId, { name: plan.name, props, root, uses: [...scope.uses].sort() });
}

function contentOf(doc: MotionDoc): Map<string, Box> {
  const space = { width: doc.width, height: doc.height };
  return new Map(Object.entries(doc.comps).flatMap(([id, comp]) => {
    const bounds = compBounds(comp, comp.frame ?? space);
    return bounds ? [[id, bounds] as [string, Box]] : [];
  }));
}

function setsOf(plans: ComponentPlan[], built: Map<string, ComponentSpec>): SetSpec[] {
  const bySet = Map.groupBy(plans.filter((p) => p.set && built.has(p.compId)), (p) => p.set!.name);
  return [...bySet].map(([name, members]) => {
    const keys = [...new Set(members.flatMap((m) => Object.keys(m.set!.variant)))];
    const axes = keys.map((key) => ({ name: key, values: [...new Set(members.map((m) => m.set!.variant[key] ?? DEFAULT_VARIANT))] }));
    const props = [...new Map(members.flatMap((m) => built.get(m.compId)!.props).map((p) => [p.name, p])).values()];
    return { name, axes, members: members.map((m) => ({ component: m.name, variant: m.set!.variant })), props };
  });
}

const pageBackground = (doc: MotionDoc, tokens: TokenBook): Rule[] => (doc.background === Background.Transparent ? [] : [['background-color', tokens.colour('brand.background', ColourRole.Page)]]);

export function buildPage(input: BuildInput): PageSpec {
  const { doc } = input;
  const tokens = new TokenBook(input.brand);
  const urls = input.assets;
  const resolve = (key: PropKey, value: string | boolean) => (key === PropKey.Image && typeof value === 'string' ? (urls[value] ?? `/assets/${value}`) : value);
  const notes = new Set<string>();
  const shared: Shared = { doc, tokens, plans: planComponents(doc, resolve), built: new Map(), assets: new Map(), urls, brand: input.brand, notes, h1: { taken: false }, content: contentOf(doc), timeline: timelineOf(doc, notes) };
  const scope = scopeOf(shared, doc.tracks, { width: doc.width, height: doc.height }, null, doc.still?.frame ?? 0, shared.timeline);
  const backdrop = scope.clips.find((c) => c.component === 'BrandBackground' && !c.parent);
  const background: Rule[] = backdrop ? [['background-color', tokens.colour(String(backdrop.props.fill ?? 'brand.background'), ColourRole.Page)]] : pageBackground(doc, tokens);
  const page = kebab(input.name);
  const root = rootOf(scope, 'main', [['width', '100%'], ['max-width', px(doc.width)], ['margin-inline', 'auto'], ...background], []);
  root.className = page;
  const order = [...shared.plans.values()].filter((p) => shared.built.has(p.compId)).map((p) => shared.built.get(p.compId)!);
  return {
    name: input.name,
    root,
    uses: [...scope.uses].sort(),
    components: order,
    sets: setsOf([...shared.plans.values()], shared.built),
    tokens: tokens.tokens(),
    assets: [...shared.assets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, url]) => ({ id, url })),
    notes: [...shared.notes].sort()
  };
}
