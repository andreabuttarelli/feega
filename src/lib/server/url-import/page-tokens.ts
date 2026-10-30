export enum ColourPaint {
  Fill = 'fill',
  Text = 'text',
  Border = 'border'
}

export type ColourUse = { hex: string; paint: ColourPaint; weight: number; button: boolean };
export type TextCase = 'as-typed' | 'upper' | 'lower' | 'title' | 'small-caps';
export type TextUse = { font: string; weight: number; sizePx: number; leading: number | null; tracking: number; textCase: TextCase; chars: number; heading: number; button: boolean };
export type EffectUse = { key: string; blur: number; shadow: boolean };
export type GradientUse = { key: string };
export type Samples = { colours: ColourUse[]; texts: TextUse[]; effects: EffectUse[]; gradients: GradientUse[]; radii: number[]; spacing: number[] };
export type SiteBrand = { palette: string[] };

export type TextStyle = Omit<TextUse, 'chars' | 'heading' | 'button'>;
export type ColourToken = { name: string; hex: string; members: string[] };
export type TextToken = { name: string; key: string; style: TextStyle };
export type KeyToken = { name: string; key: string };
export type NumberToken = { name: string; value: number };
export type Tokens = { colours: ColourToken[]; texts: TextToken[]; effects: KeyToken[]; gradients: KeyToken[]; radii: NumberToken[]; spacing: NumberToken[] };

const SAME_COLOUR = 1.5;
const BRAND_PULL = 8;
const CHROMATIC = 20;
const MIN_USES = 2;
const FILL_FIRST = 100;
const MAX_COLOURS = 16;
const MAX_TEXTS = 14;
const MAX_EFFECTS = 4;
const MAX_GRADIENTS = 4;
const MAX_SPACING = 10;
const DISPLAY_PX = 48;
const FULL_RADIUS = 999;

type Lab = [number, number, number];

type Cluster = { hex: string; lab: Lab; members: Map<string, number>; fill: number; text: number; border: number; button: number; fills: number; uses: number };

function labOf(hex: string): Lab {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92));
  const xyz = [(r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, r * 0.2126 + g * 0.7152 + b * 0.0722, (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883].map((v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116));
  return [116 * xyz[1] - 16, 500 * (xyz[0] - xyz[1]), 200 * (xyz[1] - xyz[2])];
}

const distance = (a: Lab, b: Lab) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const chromatic = (c: Cluster) => Math.hypot(c.lab[1], c.lab[2]) > CHROMATIC;

const PAINT_SCORE: Record<ColourPaint, keyof Pick<Cluster, 'fill' | 'text' | 'border'>> = {
  [ColourPaint.Fill]: 'fill',
  [ColourPaint.Text]: 'text',
  [ColourPaint.Border]: 'border'
};

function clustersOf(uses: ColourUse[]): Cluster[] {
  const byHex = new Map<string, ColourUse[]>();
  for (const use of uses) {
    const hex = use.hex.toLowerCase();
    byHex.set(hex, [...(byHex.get(hex) ?? []), use]);
  }
  const heaviest = [...byHex].sort((a, b) => total(b[1]) - total(a[1]));
  const clusters: Cluster[] = [];
  for (const [hex, list] of heaviest) {
    const lab = labOf(hex);
    const home = clusters.find((c) => distance(c.lab, lab) <= SAME_COLOUR) ?? clusters[clusters.push({ hex, lab, members: new Map(), fill: 0, text: 0, border: 0, button: 0, fills: 0, uses: 0 }) - 1];
    home.members.set(hex, list.length);
    for (const use of list) {
      home[PAINT_SCORE[use.paint]] += use.weight;
      home.button += use.button ? 1 : 0;
      home.fills += use.paint === ColourPaint.Fill ? 1 : 0;
      home.uses += 1;
    }
  }
  return clusters;
}

const total = (list: ColourUse[]) => list.reduce((s, u) => s + u.weight, 0);

const COLOUR_ROLES: { name: string; score: (c: Cluster) => number }[] = [
  { name: 'Background', score: (c) => c.fill },
  { name: 'Text', score: (c) => c.text },
  { name: 'Primary', score: (c) => (chromatic(c) && c.uses >= MIN_USES ? c.fills * FILL_FIRST + c.button + c.uses : 0) },
  { name: 'Surface', score: (c) => (chromatic(c) ? 0 : c.fill) },
  { name: 'Text muted', score: (c) => c.text },
  { name: 'Border', score: (c) => c.border },
  { name: 'Accent', score: (c) => (chromatic(c) && c.uses >= MIN_USES ? c.uses : 0) },
  ...Array.from({ length: MAX_COLOURS }, (_, i) => ({ name: `Colour ${i + 1}`, score: (c: Cluster) => (c.uses >= MIN_USES ? c.uses : 0) }))
];

function pulledToBrand(c: Cluster, brand: SiteBrand | undefined): string {
  const near = (brand?.palette ?? []).map((hex) => hex.toLowerCase()).find((hex) => distance(labOf(hex), c.lab) <= BRAND_PULL);
  return near ?? c.hex;
}

function coloursOf(uses: ColourUse[], brand: SiteBrand | undefined): ColourToken[] {
  const left = clustersOf(uses);
  const named: ColourToken[] = [];
  for (const role of COLOUR_ROLES) {
    const best = left.map((c) => ({ c, score: role.score(c) })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score)[0];
    if (!best || named.length >= MAX_COLOURS) {
      continue;
    }
    left.splice(left.indexOf(best.c), 1);
    named.push({ name: role.name, hex: pulledToBrand(best.c, brand), members: [...best.c.members.keys()].sort() });
  }
  return named;
}

export const textKey = (t: TextStyle) => [t.font, t.weight, Math.round(t.sizePx), t.leading === null ? 'auto' : t.leading.toFixed(2), t.tracking.toFixed(3), t.textCase].join('|');

type TextCluster = { key: string; style: TextStyle; uses: number; chars: number; heading: number; button: number };

function textClustersOf(uses: TextUse[]): TextCluster[] {
  const byKey = new Map<string, TextCluster>();
  for (const { chars, heading, button, ...style } of uses) {
    const key = textKey(style);
    const c = byKey.get(key) ?? { key, style, uses: 0, chars: 0, heading: 0, button: 0 };
    byKey.set(key, { ...c, uses: c.uses + 1, chars: c.chars + chars, heading: c.heading || heading, button: c.button + (button ? 1 : 0) });
  }
  return [...byKey.values()].filter((c) => c.uses >= MIN_USES || c.heading > 0);
}

type TextRule = { name: string; pick: (left: TextCluster[], body: TextCluster | undefined) => TextCluster | undefined };

const largest = (list: TextCluster[]) => [...list].sort((a, b) => b.style.sizePx - a.style.sizePx)[0];
const smallest = (list: TextCluster[]) => [...list].sort((a, b) => a.style.sizePx - b.style.sizePx)[0];
const above = (left: TextCluster[], body: TextCluster | undefined) => left.filter((c) => c.style.sizePx > (body?.style.sizePx ?? 0));
const below = (left: TextCluster[], body: TextCluster | undefined) => left.filter((c) => body && c.style.sizePx < body.style.sizePx);

const TEXT_RULES: TextRule[] = [
  { name: 'Body', pick: (left) => left.filter((c) => !c.heading && !c.button).sort((a, b) => b.chars - a.chars)[0] },
  { name: 'Button', pick: (left) => left.filter((c) => c.button > 0).sort((a, b) => b.button - a.button)[0] },
  { name: 'Display', pick: (left, body) => largest(above(left, body).filter((c) => c.style.sizePx >= DISPLAY_PX)) },
  { name: 'H1', pick: (left, body) => largest(above(left, body)) },
  { name: 'H2', pick: (left, body) => largest(above(left, body)) },
  { name: 'H3', pick: (left, body) => largest(above(left, body)) },
  { name: 'Small', pick: (left, body) => largest(below(left, body)) },
  { name: 'Caption', pick: (left, body) => smallest(below(left, body)) },
  ...Array.from({ length: MAX_TEXTS }, (_, i) => ({ name: `Text ${i + 1}`, pick: (left: TextCluster[]) => left[0] }))
];

function textsOf(uses: TextUse[]): TextToken[] {
  const left = textClustersOf(uses);
  const named: TextToken[] = [];
  let body: TextCluster | undefined;
  for (const rule of TEXT_RULES) {
    const picked = rule.pick(left, body);
    if (!picked || named.length >= MAX_TEXTS) {
      continue;
    }
    body ??= rule.name === 'Body' ? picked : undefined;
    left.splice(left.indexOf(picked), 1);
    named.push({ name: rule.name, key: picked.key, style: picked.style });
  }
  return named;
}

function counted<T>(items: T[], keyOf: (item: T) => string): { item: T; uses: number }[] {
  const byKey = new Map<string, { item: T; uses: number }>();
  for (const item of items) {
    const key = keyOf(item);
    byKey.set(key, { item, uses: (byKey.get(key)?.uses ?? 0) + 1 });
  }
  return [...byKey.values()];
}

const SHADOW_SIZES = ['small', 'medium', 'large', 'x-large'];

function effectsOf(uses: EffectUse[]): KeyToken[] {
  const kept = counted(uses, (u) => u.key)
    .filter((c) => c.uses >= MIN_USES)
    .map((c) => c.item)
    .sort((a, b) => a.blur - b.blur)
    .slice(0, MAX_EFFECTS);
  const shadows = kept.filter((e) => e.shadow);
  return kept.map((e, i) => ({ name: e.shadow && shadows.length <= SHADOW_SIZES.length ? `Shadow ${SHADOW_SIZES[shadows.indexOf(e)]}` : `Effect ${i + 1}`, key: e.key }));
}

const gradientsOf = (uses: GradientUse[]): KeyToken[] =>
  counted(uses, (u) => u.key)
    .sort((a, b) => b.uses - a.uses)
    .slice(0, MAX_GRADIENTS)
    .map((c, i) => ({ name: `Gradient ${i + 1}`, key: c.item.key }));

const scaleOf = (values: number[]) =>
  counted(values.filter((v) => v > 0).map(Math.round), String)
    .filter((c) => c.uses >= MIN_USES)
    .map((c) => c.item)
    .sort((a, b) => a - b);

const RADIUS_NAMES = ['Radius S', 'Radius M', 'Radius L', 'Radius XL', 'Radius 2XL', 'Radius 3XL'];

function radiiOf(values: number[]): NumberToken[] {
  const scale = scaleOf(values);
  const finite = scale.filter((v) => v < FULL_RADIUS).slice(0, RADIUS_NAMES.length);
  const full = scale.find((v) => v >= FULL_RADIUS);
  return [...finite.map((value, i) => ({ name: RADIUS_NAMES[i], value })), ...(full ? [{ name: 'Radius full', value: full }] : [])];
}

const spacingOf = (values: number[]): NumberToken[] =>
  scaleOf(values)
    .slice(0, MAX_SPACING)
    .map((value, i) => ({ name: `Space ${i + 1}`, value }));

export function tokensOf(samples: Samples, brand?: SiteBrand): Tokens {
  return {
    colours: coloursOf(samples.colours, brand),
    texts: textsOf(samples.texts),
    effects: effectsOf(samples.effects),
    gradients: gradientsOf(samples.gradients),
    radii: radiiOf(samples.radii),
    spacing: spacingOf(samples.spacing)
  };
}
