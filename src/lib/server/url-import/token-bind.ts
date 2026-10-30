import { compOf, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { AUTO, leadingOf, trackingOf } from '@feega/motion-core/motion/type-units';
import { DEFAULT_MODE, VarType, keyOf, type Collection } from '@feega/motion-core/motion/variables-model';
import { StyleKind, styleSchema, type Style } from '@feega/motion-core/motion/styles-model';
import type { Effect } from '@feega/motion-core/motion/effects/model';
import { EffectKind } from '@feega/motion-core/motion/effects/registry';
import { FillType, type Fill } from '@feega/motion-core/motion/fill/model';
import type { OpResult } from '@feega/motion-core/motion/timeline';
import { inEveryScope } from '$lib/motion/doc-scopes';
import { defineStyle } from '$lib/motion/styles';
import { resolveVariables } from '$lib/motion/variables';
import type { RestNode } from '$lib/server/figma/rest-message';
import { ColourPaint, textKey, type Samples, type TextCase, type TextStyle, type Tokens } from './page-tokens';

export type Units = { docPerPx: number; images: ReadonlySet<string> };

const MAX_SITE = 20;
const HEADING = /^h([1-6])$/i;
const BUTTON = /^button$/i;
const SOLID_BLEND = 'normal';
const GAP_TARGET = 'autoLayout.gap';
const TEXT_COMPONENTS = new Set(['Text', 'Title', 'Kicker', 'Caption']);
const FILL_TARGET = 'fill';
const TEXT_COLOUR_TARGET = 'color';

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

function textColour(clip: MotionClip): string | null {
  const fills = (clip.props as Paints).fills;
  const color = String(clip.props.color ?? '').toLowerCase();
  return !fills || solidOf(fills) === color ? color || null : null;
}

const gradientOf = (fills: Fill[] | undefined): string | null => (fills?.some((f) => f.type !== FillType.Solid && f.type !== FillType.Image) ? JSON.stringify(fills) : null);

const effectKey = (effects: Effect[]) => JSON.stringify(effects.map(({ id: _id, ...rest }) => rest));

type Look = { text: TextStyle | null; textColour: string | null; fill: string | null; border: string | null; gradient: string | null; effects: string | null; gap: number | null; area: number; chars: number };

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

function lookOf(clip: MotionClip, view: MotionDoc, units: Units): Look {
  const fills = (clip.props as Paints).fills;
  const strokes = clip.props.strokes as Fill[] | undefined;
  const shape = clip.component === 'Shape';
  const width = Number(clip.props.width ?? 0) * view.width;
  const height = Number(clip.props.height ?? 0) * view.height;
  const effects = clip.effects.length && clip.effects.every((e) => !e.lut) ? effectKey(clip.effects) : null;
  return {
    text: textStyleOf(clip, view, units),
    textColour: isText(clip) ? textColour(clip) : null,
    fill: shape ? solidOf(fills) : null,
    border: shape ? solidOf(strokes?.length ? strokes : undefined) : null,
    gradient: shape ? gradientOf(fills) : null,
    effects,
    gap: clip.autoLayout && clip.autoLayout.gap > 0 ? Math.round(clip.autoLayout.gap) : null,
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

export function samplesOf(docs: readonly MotionDoc[], root: RestNode, units: Units): Samples {
  const samples: Samples = { colours: [], texts: [], effects: [], gradients: [], radii: radiiIn(root).map((r) => Math.round(r * units.docPerPx)), spacing: [] };
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
        if (look.gap) {
          samples.spacing.push(look.gap);
        }
      }
    }
  }
  return samples;
}

export type Bound = { variables: number; styles: number; layers: number };

type Plan = { collection: Collection; styles: Record<string, Style>; colourOf: Map<string, string>; textOf: Map<string, string>; effectOf: Map<string, string>; gradientOf: Map<string, string>; gapOf: Map<number, string> };

const styleName = (site: string, name: string) => `${site} ${name}`;

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
    colourOf: new Map(tokens.colours.flatMap((c) => c.members.map((hex) => [hex, keyOf(site, c.name)] as const))),
    textOf: new Map(tokens.texts.flatMap((t) => kept(styleName(site, t.name)).map((n) => [t.key, n] as const))),
    effectOf: new Map(tokens.effects.flatMap((e) => kept(styleName(site, e.name)).map((n) => [e.key, n] as const))),
    gradientOf: new Map(tokens.gradients.flatMap((g) => kept(styleName(site, g.name)).map((n) => [g.key, n] as const))),
    gapOf: new Map(tokens.spacing.map((s) => [s.value, keyOf(site, s.name)]))
  };
}

function boundClip(clip: MotionClip, look: Look, plan: Plan): MotionClip {
  const bind: Record<string, string> = { ...clip.bind };
  const colour = plan.colourOf.get(look.textColour ?? look.fill ?? '');
  if (colour) {
    bind[look.textColour ? TEXT_COLOUR_TARGET : FILL_TARGET] = colour;
  }
  const gap = look.gap === null ? undefined : plan.gapOf.get(look.gap);
  if (gap) {
    bind[GAP_TARGET] = gap;
  }
  const textRef = look.text ? plan.textOf.get(textKey(look.text)) : undefined;
  const lookRef = textRef ?? (look.gradient ? plan.gradientOf.get(look.gradient) : undefined);
  const effectRef = look.effects ? plan.effectOf.get(look.effects) : undefined;
  return { ...clip, ...(Object.keys(bind).length ? { bind } : {}), ...(lookRef ? { styleRef: lookRef } : {}), ...(effectRef ? { effectStyleRef: effectRef } : {}) };
}

function linked(doc: MotionDoc, plan: Plan, units: Units): OpResult {
  return inEveryScope(doc, (view) => ({ ok: true, doc: { ...view, tracks: view.tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map((c) => (units.images.has(c.id) ? c : boundClip(c, lookOf(c, view, units), plan))) })) } }));
}

export function tokenised(doc: MotionDoc, tokens: Tokens, site: string, units: Units): MotionDoc {
  const plan = planOf(tokens, site, doc, units);
  const bound = linked({ ...doc, variables: { ...doc.variables, [site]: plan.collection } }, plan, units);
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
