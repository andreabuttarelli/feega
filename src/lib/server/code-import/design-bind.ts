import { compOf, type MotionClip, type MotionDoc, type MotionTrack } from '@feega/motion-core/motion/doc';
import { withOverride } from '@feega/motion-core/motion/precomp';
import { ShapeKind } from '@feega/motion-core/motion/shape/schema';
import { VarType, splitKey, type VarAlias, type VarLiteral, type Variables } from '@feega/motion-core/motion/variables-model';
import { LOOK, LookKey } from '$lib/canvas/code-look';
import { inEveryScope } from '$lib/motion/doc-scopes';
import { bindableTargets, resolveVariables } from '$lib/motion/variables';
import { sameColour } from '$lib/server/url-import/page-tokens';
import { uniformRadius } from '$lib/server/url-import/corner-radius';
import type { VarRule } from './css-tokens';
import { OTHER_GROUP, SPACING_BASE, tokenId, type TokenMap } from './design-tokens';
import { styleFits, type MadeStyles } from './design-styles';
import { defineStyle, slotOf } from '$lib/motion/styles';
import { StyleKind } from '@feega/motion-core/motion/styles-model';
import { parseKey } from './render-conditions';

export enum Evidence {
  Class = 'byClass',
  Rule = 'byRule',
  Value = 'byValue'
}

export type BoundCount = Record<Evidence, number> & { unbound: number };

export type BindAsk = { variables: Variables; map: TokenMap; rules: VarRule[]; base: string; boards: Record<string, string>; styles?: MadeStyles };

type View = MotionDoc;

type Target = {
  key: string;
  type: VarType;
  utility: RegExp;
  token: (name: string) => string;
  properties: string[];
  read: (clip: MotionClip, view: View) => VarLiteral | undefined;
};

type Stroke = { paint?: { type?: string; color?: string; opacity?: number }; visible?: boolean };

const SAME_NUMBER = 0.5;
const MAX_ROUNDNESS = 0.5;
const isShape = (c: MotionClip) => c.component === 'Shape';
const isText = (c: MotionClip) => c.component === 'Text';

function strokeColour(clip: MotionClip): string | undefined {
  const strokes = clip.props.strokes as Stroke[] | undefined;
  const [only] = strokes ?? [];
  return strokes?.length === 1 && only.paint?.type === 'solid' && only.visible !== false && only.paint.color ? only.paint.color.toLowerCase() : undefined;
}

function boxOf(clip: MotionClip, view: View) {
  return { width: Number(clip.props.width) * view.width, height: Number(clip.props.height) * view.height };
}

function radiusOf(clip: MotionClip, view: View): number | undefined {
  if (!isShape(clip)) {
    return undefined;
  }
  const box = boxOf(clip, view);
  if (clip.props.shape === ShapeKind.Rect) {
    return Number(clip.props.roundness ?? 0) * Math.min(box.width, box.height);
  }
  return clip.props.shape === ShapeKind.Path && typeof clip.props.path === 'string' ? (uniformRadius(clip.props.path, box) ?? undefined) : undefined;
}

function evenPadding(clip: MotionClip): number | undefined {
  const sides = clip.autoLayout ? Object.values(clip.autoLayout.padding) : [];
  return sides.length && sides.every((s) => s === sides[0]) ? sides[0] : undefined;
}

const lower = (v: unknown) => (typeof v === 'string' ? v.toLowerCase() : undefined);

const TARGETS: Target[] = [
  { key: 'color', type: VarType.Colour, utility: /^text-(.+)$/, token: (n) => `--color-${n}`, properties: ['color'], read: (c) => (isText(c) ? lower(LOOK[LookKey.Color].read(c, 1)) : undefined) },
  { key: 'fill', type: VarType.Colour, utility: /^bg-(.+)$/, token: (n) => `--color-${n}`, properties: ['background', 'background-color'], read: (c) => (isShape(c) ? lower(LOOK[LookKey.Fill].read(c, 1)) : undefined) },
  { key: 'stroke', type: VarType.Colour, utility: /^border-(.+)$/, token: (n) => `--color-${n}`, properties: ['border-color'], read: (c) => (isShape(c) ? strokeColour(c) : undefined) },
  { key: 'radius', type: VarType.Number, utility: /^rounded-(.+)$/, token: (n) => `--radius-${n}`, properties: ['border-radius'], read: radiusOf },
  { key: 'autoLayout.gap', type: VarType.Number, utility: /^gap-(.+)$/, token: (n) => `--spacing-${n}`, properties: ['gap'], read: (c) => c.autoLayout?.gap },
  { key: 'autoLayout.padding', type: VarType.Number, utility: /^p-(.+)$/, token: (n) => `--spacing-${n}`, properties: ['padding'], read: evenPadding }
];

const MULTIPLE = /^\d+(?:\.\d+)?$/;

export function spacingMultiples(classes: Iterable<string>): number[] {
  const scaled = TARGETS.filter((t) => t.token('').startsWith(`${SPACING_BASE}-`));
  const found = [...classes].flatMap((c) => scaled.map((t) => t.utility.exec(c)?.[1]).filter((n): n is string => Boolean(n) && MULTIPLE.test(n!)));
  return [...new Set(found.map(Number))].sort((a, b) => a - b);
}

const BINDABLE_KEY: Record<string, (clip: MotionClip) => boolean> = {
  radius: isShape
};

const SIMPLE_SELECTOR = /^([a-z][\w-]*)?((?:\.[\w-]+)+)?$/i;
const VARIANT_OR_MODIFIER = /[:/[\]]/;

const isAlias = (v: unknown): v is VarAlias => typeof v === 'object' && v !== null;

function resolveIn(variables: Variables, key: string, mode: string, seen: string[] = []): { leaf: string; value: VarLiteral } | null {
  const at = splitKey(key);
  const collection = at ? variables[at[0]] : undefined;
  const variable = at ? collection?.vars[at[1]] : undefined;
  if (!collection || !variable || seen.includes(key)) {
    return null;
  }
  const raw = variable.values[mode] ?? variable.values[collection.active ?? collection.modes[0]];
  return isAlias(raw) ? resolveIn(variables, raw.alias, mode, [...seen, key]) : { leaf: key, value: raw };
}

const same = (type: VarType, a: VarLiteral, b: VarLiteral) => (type === VarType.Colour ? typeof a === 'string' && typeof b === 'string' && sameColour(a, b) : typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= SAME_NUMBER);

function modesOf(variables: Variables): string[] {
  return [...new Set(Object.values(variables).flatMap((c) => c.modes))];
}

type Context = BindAsk & { byName: Map<string, string>; allModes: string[]; keys: string[] };

function consistent(ctx: Context, target: Target, key: string, mode: string, value: VarLiteral): boolean {
  const got = resolveIn(ctx.variables, key, mode);
  return Boolean(got) && same(target.type, got!.value, value);
}

function byClass(ctx: Context, target: Target, clip: MotionClip): string | undefined {
  const classes = (clip.source?.cls ?? '').split(/\s+/).filter((c) => c && !VARIANT_OR_MODIFIER.test(c));
  const names = classes.map((c) => target.utility.exec(c)?.[1]).filter((n): n is string => Boolean(n));
  return names.map((n) => ctx.byName.get(target.token(n))).findLast(Boolean);
}

function matches(selector: string, clip: MotionClip): boolean {
  const m = SIMPLE_SELECTOR.exec(selector.trim());
  if (!m || (!m[1] && !m[2]) || !clip.source) {
    return false;
  }
  const classes = new Set((clip.source.cls ?? '').split(/\s+/));
  const tagOk = !m[1] || m[1].toLowerCase() === clip.source.tag;
  const wanted = (m[2] ?? '').split('.').filter(Boolean);
  return tagOk && wanted.every((c) => classes.has(c));
}

function byRule(ctx: Context, target: Target, clip: MotionClip): string | undefined {
  const rule = ctx.rules.findLast((r) => target.properties.includes(r.property) && r.selector.split(',').some((s) => matches(s, clip)));
  return rule ? ctx.byName.get(rule.token) : undefined;
}

function byValue(ctx: Context, target: Target, mode: string, value: VarLiteral): string | undefined {
  const leaves = new Set<string>();
  for (const key of ctx.keys) {
    const hits = ctx.allModes.map((m) => resolveIn(ctx.variables, key, m)).filter((r) => r && typeof r.value === typeof value && same(target.type, r.value, value));
    hits.forEach((h) => leaves.add(h!.leaf));
  }
  const [leaf] = leaves;
  return leaves.size === 1 && consistent(ctx, target, leaf, mode, value) ? leaf : undefined;
}

const EVIDENCE: { evidence: Evidence; find: (ctx: Context, target: Target, clip: MotionClip, mode: string, value: VarLiteral) => string | undefined }[] = [
  { evidence: Evidence.Class, find: (ctx, t, c) => byClass(ctx, t, c) },
  { evidence: Evidence.Rule, find: (ctx, t, c) => byRule(ctx, t, c) },
  { evidence: Evidence.Value, find: (ctx, t, _c, mode, value) => byValue(ctx, t, mode, value) }
];

const typeOf = (variables: Variables, key: string) => {
  const at = splitKey(key);
  return at ? variables[at[0]]?.vars[at[1]]?.type : undefined;
};

function asRect(clip: MotionClip, view: View, radius: number): MotionClip {
  if (clip.props.shape === ShapeKind.Rect) {
    return clip;
  }
  const box = boxOf(clip, view);
  return { ...clip, props: { ...clip.props, shape: ShapeKind.Rect, path: '', corners: [], roundness: Math.min(MAX_ROUNDNESS, radius / Math.min(box.width, box.height)) } };
}

function modeOfClip(ctx: Context, clip: MotionClip, parents: Map<string, MotionClip>): string {
  if (clip.source?.cond) {
    const scheme = parseKey(clip.source.cond).scheme;
    return scheme.charAt(0).toUpperCase() + scheme.slice(1);
  }
  for (let at: MotionClip | undefined = clip, guard = 0; at && guard < parents.size + 1; guard++) {
    const board = at.name ? ctx.boards[at.name] : undefined;
    if (board && parents.get(at.id)?.parent === undefined) {
      return board;
    }
    at = at.parent ? parents.get(at.parent) : undefined;
  }
  return ctx.base;
}

function boundClip(ctx: Context, clip: MotionClip, view: View, mode: string, count: BoundCount): MotionClip {
  let next = clip;
  const bind: Record<string, string> = { ...clip.bind };
  for (const target of TARGETS) {
    const value = target.read(clip, view);
    const allowed = BINDABLE_KEY[target.key]?.(clip) ?? bindableTargets(clip, target.type).includes(target.key);
    if (value === undefined || !allowed || bind[target.key]) {
      continue;
    }
    const found = EVIDENCE.map((e) => ({ e, key: e.find(ctx, target, clip, mode, value) })).find(({ key }) => key && typeOf(ctx.variables, key) === target.type && consistent(ctx, target, key, mode, value));
    if (!found) {
      count.unbound++;
      continue;
    }
    count[found.e.evidence]++;
    bind[target.key] = found.key!;
    next = target.key === 'radius' ? asRect(next, view, Number(value)) : next;
  }
  return Object.keys(bind).length ? { ...next, bind } : next;
}

type StyleEvidence = { evidence: Evidence; find: (made: MadeStyles, clip: MotionClip, kind: StyleKind, fits: (name: string) => boolean) => string | undefined };

const classesOf = (clip: MotionClip) => (clip.source?.cls ?? '').split(/\s+/).filter((c) => c && !VARIANT_OR_MODIFIER.test(c));

const STYLE_EVIDENCE: StyleEvidence[] = [
  { evidence: Evidence.Class, find: (made, clip, kind) => classesOf(clip).map((c) => made.utilities.get(c)).findLast((name) => name && made.styles[name].kind === kind) },
  { evidence: Evidence.Rule, find: (made, clip, kind) => made.rules.findLast((r) => made.styles[r.style].kind === kind && r.selector.split(',').some((sel) => matches(sel, clip)))?.style },
  {
    evidence: Evidence.Value,
    find: (made, _clip, kind, fits) => {
      const hits = Object.keys(made.styles).filter((name) => made.styles[name].kind === kind && fits(name));
      return hits.length === 1 ? hits[0] : undefined;
    }
  }
];

const STYLED: { kind: StyleKind; applies: (clip: MotionClip) => boolean }[] = [
  { kind: StyleKind.Text, applies: isText },
  { kind: StyleKind.Effect, applies: (clip) => clip.effects.length > 0 }
];

function styledClip(made: MadeStyles, clip: MotionClip, view: View, rootUnit: number, count: BoundCount): MotionClip {
  let next = clip;
  for (const { kind } of STYLED.filter((s) => s.applies(clip))) {
    const slot = slotOf(kind);
    if (clip[slot]) {
      continue;
    }
    const fits = (name: string) => styleFits(made.styles[name], clip, Math.min(view.width, view.height), rootUnit);
    const found = STYLE_EVIDENCE.map((e) => ({ e, name: e.find(made, clip, kind, fits) })).find(({ name }) => name && fits(name));
    if (!found) {
      count.unbound++;
      continue;
    }
    count[found.e.evidence]++;
    next = { ...next, [slot]: found.name };
  }
  return next;
}

function withStyles(doc: MotionDoc, made: MadeStyles): MotionDoc {
  let next: MotionDoc = { ...doc, styles: { ...doc.styles, ...made.styles } };
  for (const [name, style] of Object.entries(made.styles)) {
    const painted = defineStyle(next, name, style);
    next = painted.ok ? painted.doc : next;
  }
  return next;
}

function modesFor(variables: Variables, mode: string): Record<string, string> {
  return Object.fromEntries(Object.entries(variables).filter(([, c]) => c.modes.includes(mode)).map(([name]) => [name, mode]));
}

function boardModes(doc: MotionDoc, ctx: Context): MotionDoc {
  const clips = new Map(doc.tracks.flatMap((t) => t.clips as MotionClip[]).map((c) => [c.id, c]));
  const onRoot = (clip: MotionClip) => !clip.parent || !clips.get(clip.parent)?.parent;
  const modeOf = (clip: MotionClip) => (clip.name && onRoot(clip) ? ctx.boards[clip.name] : undefined);
  const tracks = doc.tracks.map((t) => ({
    ...t,
    clips: (t.clips as MotionClip[]).map((c) => {
      const mode = modeOf(c);
      const modes = mode && mode !== ctx.base ? modesFor(ctx.variables, mode) : {};
      return Object.keys(modes).length ? { ...c, modes } : c;
    })
  }));
  return { ...doc, tracks } as MotionDoc;
}

type Overrides = Record<string, Record<string, unknown>>;

const OWNED_KEYS: Record<string, string[]> = { fill: ['fill', 'fills'], color: ['color', 'fills'], stroke: ['stroke', 'strokes'], radius: ['roundness', 'corners', 'shape', 'path'] };

function keptOverride(inner: MotionClip, own: Record<string, unknown>, moded: Record<string, unknown>, view: View): Record<string, unknown> {
  let kept = own;
  for (const target of TARGETS.filter((t) => inner.bind?.[t.key])) {
    const shown = (c: MotionClip) => target.read(c, view) ?? (target.type === VarType.Colour ? lower(c.props[target.key]) : undefined);
    const [mine, theirs] = [shown(withOverride(inner, kept)), shown(withOverride(inner, moded))];
    if (mine === undefined || theirs === undefined || !same(target.type, mine, theirs)) {
      continue;
    }
    const owned = OWNED_KEYS[target.key] ?? [target.key];
    kept = Object.fromEntries(Object.entries(kept).filter(([k]) => !owned.includes(k)));
  }
  return kept;
}

function hostWithout(doc: MotionDoc, host: MotionClip): MotionClip {
  const comp = doc.comps[compOf(host) ?? ''];
  const [overrides, moded] = [host.props.overrides as Overrides | undefined, host.props.modeValues as Overrides | undefined];
  if (!comp || !overrides || !moded) {
    return host;
  }
  const inner = new Map(comp.tracks.flatMap((t) => t.clips as MotionClip[]).map((c) => [c.id, c]));
  const view = { ...doc, ...(comp.frame ?? {}) } as View;
  const next = Object.fromEntries(
    Object.entries(overrides)
      .map(([id, own]) => [id, inner.has(id) && moded[id] ? keptOverride(inner.get(id)!, own, moded[id], view) : own] as const)
      .filter(([, own]) => Object.keys(own).length)
  );
  const { overrides: _old, ...props } = host.props;
  return { ...host, props: Object.keys(next).length ? { ...props, overrides: next } : props };
}

function withoutModeLiterals(doc: MotionDoc): MotionDoc {
  const strip = (tracks: MotionTrack[]) => tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map((c) => (compOf(c) ? hostWithout(doc, c) : c)) })) as MotionTrack[];
  return { ...doc, tracks: strip(doc.tracks), comps: Object.fromEntries(Object.entries(doc.comps).map(([id, comp]) => [id, { ...comp, tracks: strip(comp.tracks) }])) };
}

export function boundToTokens(doc: MotionDoc, ask: BindAsk): { doc: MotionDoc; bound: BoundCount } {
  const byName = new Map(Object.entries(ask.map).map(([key, entry]) => [tokenId(entry), key]));
  const keys = Object.entries(ask.variables)
    .filter(([c]) => !c.endsWith(` ${OTHER_GROUP}`))
    .flatMap(([c, col]) => Object.keys(col.vars).map((v) => `${c}/${v}`));
  const ctx: Context = { ...ask, byName, allModes: modesOf(ask.variables), keys };
  const count: BoundCount = { [Evidence.Class]: 0, [Evidence.Rule]: 0, [Evidence.Value]: 0, unbound: 0 };
  const withVars = { ...doc, variables: { ...doc.variables, ...ask.variables } };

  const styles = ask.styles;
  const done = inEveryScope(withVars, (view, rootUnit) => {
    const clips = view.tracks.flatMap((t) => t.clips as MotionClip[]);
    const parents = new Map(clips.map((c) => [c.id, c]));
    const bound = (c: MotionClip) => (c.source || !c.bind ? boundClip(ctx, c, view, modeOfClip(ctx, c, parents), count) : c);
    const styled = (c: MotionClip) => (styles && c.source ? styledClip(styles, c, view, rootUnit, count) : c);
    const tracks = view.tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map((c) => styled(bound(c))) }));
    return { ok: true, doc: { ...view, tracks } as MotionDoc };
  });
  const laid = done.ok ? done.doc : withVars;
  const moded = resolveVariables(boardModes(styles ? withStyles(laid, styles) : laid, ctx));
  return { doc: withoutModeLiterals(moded), bound: count };
}
