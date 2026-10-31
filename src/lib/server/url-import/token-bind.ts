import { compOf, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { AUTO, leadingOf, trackingOf } from '@feega/motion-core/motion/type-units';
import { DEFAULT_MODE, VarType, keyOf, splitKey, type Collection } from '@feega/motion-core/motion/variables-model';
import { StyleKind, styleSchema, type Style } from '@feega/motion-core/motion/styles-model';
import type { Effect } from '@feega/motion-core/motion/effects/model';
import { EffectKind } from '@feega/motion-core/motion/effects/registry';
import { FillType, type Fill } from '@feega/motion-core/motion/fill/model';
import type { OpResult } from '@feega/motion-core/motion/timeline';
import { inEveryScope } from '$lib/motion/doc-scopes';
import { defineStyle } from '$lib/motion/styles';
import { resolveVariables } from '$lib/motion/variables';
import type { RestNode } from '$lib/server/figma/rest-message';
import { ShapeKind } from '@feega/motion-core/motion/shape/schema';
import { uniformRadius } from './corner-radius';
import { ColourPaint, FULL_RADIUS, sameColour, textKey, type CtaUse, type Samples, type TextCase, type TextStyle, type Tokens } from './page-tokens';

export type Units = { docPerPx: number; images: ReadonlySet<string> };

const MAX_SITE = 20;
const HEADING = /^h([1-6])$/i;
const BUTTON = /^button$/i;
const SOLID_BLEND = 'normal';
const GAP_TARGET = 'autoLayout.gap';
const PADDING_TARGET = 'autoLayout.padding';
const TEXT_COMPONENTS = new Set(['Text', 'Title', 'Kicker', 'Caption']);
const FILL_TARGET = 'fill';
const TEXT_COLOUR_TARGET = 'color';
const STROKE_TARGET = 'stroke';
const RADIUS_TARGET = 'radius';
const MAX_ROUNDNESS = 0.5;

export function siteName(url: string): string {
  const host = URL.canParse(url) ? new URL(url).hostname.replace(/^www\./, '') : 'Site';
  const word = host.split('.')[0].replace(/[^A-Za-z0-9 _-]/g, '') || 'Site';
  return (word[0].toUpperCase() + word.slice(1)).slice(0, MAX_SITE);
}

type Scope = { view: MotionDoc; compId: string | null };

type Host = { name: string; parent: string | null };

function hostsOf(doc: MotionDoc): Map<string, Host> {
  const hosts = new Map<string, Host>();
  const scan = (tracks: MotionDoc['tracks'], parent: string | null) => {
    for (const clip of tracks.flatMap((t) => t.clips as MotionClip[])) {
      const comp = compOf(clip);
      if (comp && !hosts.has(comp)) {
        hosts.set(comp, { name: clip.name ?? '', parent });
      }
    }
  };
  scan(doc.tracks, null);
  Object.entries(doc.comps).forEach(([id, comp]) => scan(comp.tracks, id));
  return hosts;
}

function ancestry(hosts: Map<string, Host>, compId: string | null): string[] {
  const names: string[] = [];
  for (let at = compId, guard = 0; at && guard < hosts.size + 1; guard++) {
    const host = hosts.get(at);
    names.push(host?.name ?? '');
    at = host?.parent ?? null;
  }
  return names;
}

const headingOf = (names: string[]) => Number(names.map((n) => HEADING.exec(n)?.[1]).find(Boolean) ?? 0);

type Paints = { fills?: Fill[] };

const solidOf = (fills: Fill[] | undefined): string | null => {
  if (!fills) {
    return null;
  }
  const [only] = fills;
  return fills.length === 1 && only.type === FillType.Solid && only.visible !== false && (only.opacity ?? 1) === 1 && (only.blend ?? SOLID_BLEND) === SOLID_BLEND ? only.color.toLowerCase() : null;
};

type StrokePaint = { paint?: { type?: string; color?: string; opacity?: number }; visible?: boolean };

function strokeColour(strokes: StrokePaint[] | undefined): string | null {
  const [only] = strokes ?? [];
  return strokes?.length === 1 && only.paint?.type === FillType.Solid && only.visible !== false && (only.paint.opacity ?? 1) === 1 && only.paint.color ? only.paint.color.toLowerCase() : null;
}

function textColour(clip: MotionClip): string | null {
  const fills = (clip.props as Paints).fills;
  const color = String(clip.props.color ?? '').toLowerCase();
  return !fills || solidOf(fills) === color ? color || null : null;
}

const gradientOf = (fills: Fill[] | undefined): string | null => (fills?.some((f) => f.type !== FillType.Solid && f.type !== FillType.Image) ? JSON.stringify(fills) : null);

const effectKey = (effects: Effect[]) => JSON.stringify(effects.map(({ id: _id, ...rest }) => rest));

type Look = { text: TextStyle | null; textColour: string | null; fill: string | null; border: string | null; gradient: string | null; effects: string | null; gap: number | null; padding: number | null; area: number; chars: number };

const isText = (clip: MotionClip) => TEXT_COMPONENTS.has(clip.component);

function textStyleOf(clip: MotionClip, view: MotionDoc, units: Units): TextStyle | null {
  const size = Number(clip.props.size);
  if (!isText(clip) || !Number.isFinite(size) || !clip.props.font) {
    return null;
  }
  const docPx = size * view.width;
  const leading = leadingOf(clip.props, docPx);
  return {
    font: String(clip.props.font),
    weight: Number(clip.props.weight ?? 400),
    sizePx: docPx / units.docPerPx,
    leading: leading === AUTO ? null : Number(leading),
    tracking: trackingOf(clip.props, docPx),
    textCase: (clip.props.textCase ?? 'as-typed') as TextCase
  };
}

function evenPadding(clip: MotionClip): number | null {
  const sides = clip.autoLayout ? Object.values(clip.autoLayout.padding) : [];
  return sides.length && sides[0] > 0 && sides.every((side) => side === sides[0]) ? Math.round(sides[0]) : null;
}

function lookOf(clip: MotionClip, view: MotionDoc, units: Units): Look {
  const fills = (clip.props as Paints).fills;
  const strokes = clip.props.strokes as StrokePaint[] | undefined;
  const shape = clip.component === 'Shape';
  const width = Number(clip.props.width ?? 0) * view.width;
  const height = Number(clip.props.height ?? 0) * view.height;
  const effects = clip.effects.length && clip.effects.every((e) => !e.lut) ? effectKey(clip.effects) : null;
  return {
    text: textStyleOf(clip, view, units),
    textColour: isText(clip) ? textColour(clip) : null,
    fill: shape ? solidOf(fills) : null,
    border: shape ? strokeColour(strokes) : null,
    gradient: shape ? gradientOf(fills) : null,
    effects,
    gap: clip.autoLayout && clip.autoLayout.gap > 0 ? Math.round(clip.autoLayout.gap) : null,
    padding: evenPadding(clip),
    area: (width * height) / units.docPerPx ** 2,
    chars: String(clip.props.text ?? '').length
  };
}

function scopesOf(doc: MotionDoc): Scope[] {
  return [{ view: doc, compId: null }, ...Object.entries(doc.comps).map(([id, comp]) => ({ view: { ...doc, ...comp.frame, tracks: comp.tracks }, compId: id }))];
}

const radiusOf = (n: RestNode): number | null => {
  const corners = n.rectangleCornerRadii;
  if (corners?.length && corners.every((c) => c === corners[0])) {
    return corners[0];
  }
  return n.cornerRadius ?? null;
};

function radiiIn(root: RestNode): number[] {
  const found: number[] = [];
  const visit = (n: RestNode) => {
    const r = radiusOf(n);
    if (r && r > 0) {
      found.push(r);
    }
    (n.children ?? []).forEach(visit);
  };
  visit(root);
  return found;
}

const CTA_NAME = /^(a|button)( \d+)?(\s*\/.*)?$/i;
const CTA_HEIGHT = 64;

const textsIn = (n: RestNode): number => (n.type === 'TEXT' ? 1 : 0) + (n.children ?? []).reduce((sum, c) => sum + textsIn(c), 0);

const channel = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');

function ctaOf(n: RestNode): CtaUse | null {
  const box = n.absoluteBoundingBox;
  const solid = n.fills?.filter((f) => f.type === 'SOLID' && f.visible !== false && (f.opacity ?? 1) === 1 && (f.color?.a ?? 1) === 1) ?? [];
  if (!box || !CTA_NAME.test(n.name ?? '') || box.height > CTA_HEIGHT || solid.length !== 1 || n.fills!.length !== 1 || textsIn(n) !== 1) {
    return null;
  }
  const { r, g, b } = solid[0].color!;
  return { hex: `#${channel(r)}${channel(g)}${channel(b)}`, area: box.width * box.height };
}

function ctasIn(root: RestNode): CtaUse[] {
  const found: CtaUse[] = [];
  const visit = (n: RestNode) => {
    const cta = ctaOf(n);
    if (cta) {
      found.push(cta);
    }
    (n.children ?? []).forEach(visit);
  };
  visit(root);
  return found;
}

export function samplesOf(docs: readonly MotionDoc[], root: RestNode, units: Units): Samples {
  const samples: Samples = { colours: [], texts: [], effects: [], gradients: [], radii: radiiIn(root).map((r) => Math.round(r * units.docPerPx)), spacing: [], ctas: ctasIn(root) };
  for (const doc of docs) {
    const hosts = hostsOf(doc);
    for (const { view, compId } of scopesOf(doc)) {
      const names = ancestry(hosts, compId);
      const button = names.some((n) => BUTTON.test(n));
      for (const clip of view.tracks.flatMap((t) => t.clips as MotionClip[]).filter((c) => !units.images.has(c.id))) {
        const look = lookOf(clip, view, units);
        if (look.text) {
          samples.texts.push({ ...look.text, chars: look.chars, heading: headingOf(names), button });
        }
        if (look.textColour) {
          samples.colours.push({ hex: look.textColour, paint: ColourPaint.Text, weight: Math.max(1, look.chars), button });
        }
        if (look.fill) {
          samples.colours.push({ hex: look.fill, paint: ColourPaint.Fill, weight: Math.max(1, look.area), button });
        }
        if (look.border) {
          samples.colours.push({ hex: look.border, paint: ColourPaint.Border, weight: 1, button });
        }
        if (look.gradient) {
          samples.gradients.push({ key: look.gradient });
        }
        if (look.effects) {
          samples.effects.push({ key: look.effects, blur: Math.max(...clip.effects.map((e) => Number(e.params.blur ?? e.params.radius ?? 0))), shadow: clip.effects.every((e) => e.kind === EffectKind.DropShadow) });
        }
        samples.spacing.push(...[look.gap, look.padding].filter((v): v is number => v !== null));
      }
    }
  }
  return samples;
}

export type Bound = { variables: number; styles: number; layers: number };

type Plan = { collection: Collection; styles: Record<string, Style>; colourOf: Map<string, string>; textOf: Map<string, string>; effectOf: Map<string, string>; gradientOf: Map<string, string>; gapOf: Map<number, string>; radiusOf: Map<number, string>; fullRadius: string | undefined };

const styleName = (site: string, name: string) => `${site} ${name}`;

const paintKey = (paint: ColourPaint, hex: string) => `${paint}|${hex}`;

const LEADING_PLACES = 2;
const TRACKING_PLACES = 3;

const rounded = (value: number, places: number) => Number(value.toFixed(places));

function planOf(tokens: Tokens, site: string, root: MotionDoc, units: Units): Plan {
  const number = (value: number) => ({ type: VarType.Number, values: { [DEFAULT_MODE]: value } });
  const vars = {
    ...Object.fromEntries(tokens.colours.map((c) => [c.name, { type: VarType.Colour, values: { [DEFAULT_MODE]: c.hex } }])),
    ...Object.fromEntries([...tokens.radii, ...tokens.spacing].map((n) => [n.name, number(n.value)]))
  };
  const text = (s: TextStyle): Style => ({ kind: StyleKind.Text, font: s.font, weight: s.weight, size: (s.sizePx * units.docPerPx) / root.width, tracking: rounded(s.tracking, TRACKING_PLACES), textCase: s.textCase, ...(s.leading === null ? {} : { leading: rounded(s.leading, LEADING_PLACES) }) });
  const candidates: [string, Style][] = [
    ...tokens.texts.map((t): [string, Style] => [styleName(site, t.name), text(t.style)]),
    ...tokens.effects.map((e): [string, Style] => [styleName(site, e.name), { kind: StyleKind.Effect, effects: JSON.parse(e.key).map((fx: Omit<Effect, 'id'>, i: number) => ({ id: `fx${i + 1}`, ...fx })) }]),
    ...tokens.gradients.map((g): [string, Style] => [styleName(site, g.name), { kind: StyleKind.Paint, fills: JSON.parse(g.key) }])
  ];
  const styles = Object.fromEntries(candidates.filter(([, s]) => styleSchema.safeParse(s).success));
  const kept = (name: string) => (styles[name] ? [name] : []);
  return {
    collection: { modes: [DEFAULT_MODE], vars },
    styles,
    colourOf: new Map(tokens.colours.flatMap((c) => c.paints.flatMap((paint) => c.members.map((hex) => [paintKey(paint, hex), keyOf(site, c.name)] as const)))),
    textOf: new Map(tokens.texts.flatMap((t) => kept(styleName(site, t.name)).map((n) => [t.key, n] as const))),
    effectOf: new Map(tokens.effects.flatMap((e) => kept(styleName(site, e.name)).map((n) => [e.key, n] as const))),
    gradientOf: new Map(tokens.gradients.flatMap((g) => kept(styleName(site, g.name)).map((n) => [g.key, n] as const))),
    gapOf: new Map(tokens.spacing.map((s) => [s.value, keyOf(site, s.name)])),
    radiusOf: new Map(tokens.radii.map((r) => [r.value, keyOf(site, r.name)])),
    fullRadius: tokens.radii.filter((r) => r.value >= FULL_RADIUS).map((r) => keyOf(site, r.name))[0]
  };
}

function cornered(clip: MotionClip, view: MotionDoc, plan: Plan): MotionClip {
  if (clip.component !== 'Shape' || clip.props.shape !== ShapeKind.Path || typeof clip.props.path !== 'string') {
    return clip;
  }
  const box = { width: Number(clip.props.width) * view.width, height: Number(clip.props.height) * view.height };
  const radius = uniformRadius(clip.props.path, box);
  if (radius === null) {
    return clip;
  }
  const short = Math.min(box.width, box.height);
  const key = plan.radiusOf.get(Math.round(radius)) ?? (Math.abs(radius - short * MAX_ROUNDNESS) <= 1 ? plan.fullRadius : undefined);
  if (!key) {
    return clip;
  }
  return { ...clip, bind: { ...clip.bind, [RADIUS_TARGET]: key }, props: { ...clip.props, shape: ShapeKind.Rect, path: '', corners: [], roundness: Math.min(MAX_ROUNDNESS, radius / short) } };
}

function boundClip(clip: MotionClip, look: Look, plan: Plan, view: MotionDoc): MotionClip {
  const bind: Record<string, string> = { ...clip.bind };
  const colour = plan.colourOf.get(look.textColour ? paintKey(ColourPaint.Text, look.textColour) : paintKey(ColourPaint.Fill, look.fill ?? ''));
  if (colour) {
    bind[look.textColour ? TEXT_COLOUR_TARGET : FILL_TARGET] = colour;
  }
  const border = look.border ? plan.colourOf.get(paintKey(ColourPaint.Border, look.border)) : undefined;
  if (border) {
    bind[STROKE_TARGET] = border;
  }
  const gap = look.gap === null ? undefined : plan.gapOf.get(look.gap);
  if (gap) {
    bind[GAP_TARGET] = gap;
  }
  const padding = look.padding === null ? undefined : plan.gapOf.get(look.padding);
  if (padding) {
    bind[PADDING_TARGET] = padding;
  }
  const textRef = look.text ? plan.textOf.get(textKey(look.text)) : undefined;
  const lookRef = textRef ?? (look.gradient ? plan.gradientOf.get(look.gradient) : undefined);
  const effectRef = look.effects ? plan.effectOf.get(look.effects) : undefined;
  return cornered({ ...clip, ...(Object.keys(bind).length ? { bind } : {}), ...(lookRef ? { styleRef: lookRef } : {}), ...(effectRef ? { effectStyleRef: effectRef } : {}) }, view, plan);
}

function linked(doc: MotionDoc, plan: Plan, units: Units): OpResult {
  return inEveryScope(doc, (view) => ({ ok: true, doc: { ...view, tracks: view.tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map((c) => (units.images.has(c.id) ? c : boundClip(c, lookOf(c, view, units), plan, view))) })) } }));
}

type Overrides = Record<string, Record<string, unknown>>;

const OVERRIDE_PAINTS: { key: string; paint: ColourPaint; target: string; hex: (value: unknown) => string | null }[] = [
  { key: 'color', paint: ColourPaint.Text, target: TEXT_COLOUR_TARGET, hex: (value) => (typeof value === 'string' ? value.toLowerCase() : null) },
  { key: 'fill', paint: ColourPaint.Fill, target: FILL_TARGET, hex: (value) => (typeof value === 'string' ? value.toLowerCase() : null) },
  { key: 'fills', paint: ColourPaint.Fill, target: FILL_TARGET, hex: (value) => solidOf(value as Fill[] | undefined) }
];

function inheritedPaints(override: Record<string, unknown>, main: MotionClip | undefined, plan: Plan): Record<string, unknown> {
  const inherits = (rule: (typeof OVERRIDE_PAINTS)[number]) => {
    const hex = rule.hex(override[rule.key]);
    const bound = main?.bind?.[rule.target];
    const name = bound ? splitKey(bound)?.[1] : undefined;
    const value = name ? plan.collection.vars[name]?.values[DEFAULT_MODE] : undefined;
    return Boolean(hex && bound && (plan.colourOf.get(paintKey(rule.paint, hex)) === bound || (typeof value === 'string' && sameColour(hex, value))));
  };
  const dropped = new Set(OVERRIDE_PAINTS.filter((rule) => rule.key in override && inherits(rule)).map((rule) => rule.key));
  return Object.fromEntries(Object.entries(override).filter(([key]) => !dropped.has(key)));
}

function keepingBindings(clip: MotionClip, doc: MotionDoc, plan: Plan): MotionClip {
  const overrides = clip.props.overrides as Overrides | undefined;
  const comp = compOf(clip) ? doc.comps[compOf(clip)!] : undefined;
  if (!overrides || !comp) {
    return clip;
  }
  const inner = new Map(comp.tracks.flatMap((t) => t.clips as MotionClip[]).map((c) => [c.id, c]));
  const kept = Object.fromEntries(Object.entries(overrides).map(([id, o]) => [id, inheritedPaints(o, inner.get(id), plan)]).filter(([, o]) => Object.keys(o as object).length));
  return { ...clip, props: { ...clip.props, overrides: kept } };
}

function overridesBound(doc: MotionDoc, plan: Plan): OpResult {
  return inEveryScope(doc, (view) => ({ ok: true, doc: { ...view, tracks: view.tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map((c) => keepingBindings(c, doc, plan)) })) } }));
}

export function tokenised(doc: MotionDoc, tokens: Tokens, site: string, units: Units): MotionDoc {
  const plan = planOf(tokens, site, doc, units);
  const linkedDoc = linked({ ...doc, variables: { ...doc.variables, [site]: plan.collection } }, plan, units);
  const bound = linkedDoc.ok ? overridesBound(linkedDoc.doc, plan) : linkedDoc;
  if (!bound.ok) {
    return doc;
  }
  let next: MotionDoc = { ...bound.doc, styles: { ...doc.styles, ...plan.styles } };
  for (const [name, style] of Object.entries(plan.styles)) {
    const painted = defineStyle(next, name, style);
    next = painted.ok ? painted.doc : next;
  }
  return resolveVariables(next);
}
