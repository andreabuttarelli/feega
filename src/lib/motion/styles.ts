import type { z } from 'zod';
import { findClip, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { fieldsOf } from './inspector';
import { inEveryScope } from './doc-scopes';
import { FillType } from '@feega/motion-core/motion/fill/model';
import { FILLED, elementFills } from '@feega/motion-core/motion/fill/elements';
import { effectOfKey, effectsProblem, type Effect } from '@feega/motion-core/motion/effects/model';
import { editClip, setProps, type OpResult } from '@feega/motion-core/motion/timeline';
import { COMPONENTS, TrackKind, type ComponentId } from '@feega/motion-core/motion/components';
import { STYLE_NAME, StyleKind, styleSchema, stylesSchema, type Style, type textStyleSchema, type colourStyleSchema } from '@feega/motion-core/motion/styles-model';

export { StyleKind };

export enum StyleAction {
  Define = 'define',
  Apply = 'apply',
  Detach = 'detach',
  Save = 'save',
  Remove = 'remove',
  Rename = 'rename',
  List = 'list'
}

export enum StyleSlot {
  Look = 'styleRef',
  Effect = 'effectStyleRef'
}

export type NamedStyle = { name: string; style: Style; clips: string[] };

export const SLOTS = Object.values(StyleSlot);
const SLOT_OF: Record<StyleKind, StyleSlot> = {
  [StyleKind.Text]: StyleSlot.Look,
  [StyleKind.Colour]: StyleSlot.Look,
  [StyleKind.Paint]: StyleSlot.Look,
  [StyleKind.Effect]: StyleSlot.Effect
};

export const slotOf = (kind: StyleKind): StyleSlot => SLOT_OF[kind];

const TEXT_KEY = 'font';
const COLOUR_KEY = 'color';
const FILLS_KEY = 'fills';

function keysOf(component: ComponentId): Set<string> {
  return new Set(fieldsOf(component).map((f) => f.key));
}

const REFUSAL: Record<StyleKind, (component: ComponentId) => string | null> = {
  [StyleKind.Text]: (component) => (keysOf(component).has(TEXT_KEY) ? null : 'a text style goes on a text clip'),
  [StyleKind.Colour]: (component) => (keysOf(component).has(COLOUR_KEY) || keysOf(component).has(FILLS_KEY) ? null : 'this clip has no colour to style'),
  [StyleKind.Paint]: (component) => (component in FILLED ? null : 'this clip has no fill to style'),
  [StyleKind.Effect]: (component) => (COMPONENTS[component].track === TrackKind.Visual ? null : 'effects go on a visual clip')
};

const MEASURE_OF: Record<string, string> = { leading: 'lineHeight', tracking: 'letterSpacing' };

function textPatch(style: z.infer<typeof textStyleSchema>, keys: Set<string>): Record<string, unknown> {
  const { kind: _kind, ...props } = style;
  const own = Object.entries(props).filter(([k, v]) => v !== undefined && keys.has(k));
  const measures = own.flatMap(([k]) => (MEASURE_OF[k] && keys.has(MEASURE_OF[k]) ? [[MEASURE_OF[k], '']] : []));
  return Object.fromEntries([...own, ...measures]);
}

function colourPatch(style: z.infer<typeof colourStyleSchema>, keys: Set<string>): Record<string, unknown> {
  return keys.has(COLOUR_KEY) ? { color: style.color } : { fills: [{ type: FillType.Solid, color: style.color, opacity: 1, visible: true }] };
}

const omitKeys = <T>(record: Record<string, T>, drop: (key: string) => boolean): Record<string, T> => Object.fromEntries(Object.entries(record).filter(([key]) => !drop(key)));

function effectsApplied(doc: MotionDoc, clipId: string, effects: Effect[]): OpResult {
  const kept = new Set(effects.map((e) => e.id));
  const stale = (key: string) => {
    const ref = effectOfKey(key);
    return ref !== null && !kept.has(ref.effectId);
  };
  return editClip(doc, clipId, (clip) => effectsProblem(effects) ?? { ...clip, effects, keyframes: omitKeys(clip.keyframes, stale), expressions: omitKeys(clip.expressions, stale) });
}

const EFFECTS_KEY = 'effects';

type StyleOf<K extends StyleKind> = Extract<Style, { kind: K }>;

const PATCH: { [K in StyleKind]: (clip: MotionClip, style: StyleOf<K>) => Record<string, unknown> } = {
  [StyleKind.Text]: (clip, style) => textPatch(style, keysOf(clip.component)),
  [StyleKind.Colour]: (clip, style) => colourPatch(style, keysOf(clip.component)),
  [StyleKind.Paint]: (_, style) => ({ fills: style.fills }),
  [StyleKind.Effect]: (_, style) => ({ [EFFECTS_KEY]: style.effects })
};

export const stylePatch = (clip: MotionClip, style: Style): Record<string, unknown> => (PATCH[style.kind] as (clip: MotionClip, style: Style) => Record<string, unknown>)(clip, style);

const bare = (effects: readonly Effect[]) => effects.map(({ lut: _lut, ...effect }) => effect);

export const currentOf = (clip: MotionClip, key: string): unknown => (key === EFFECTS_KEY ? bare(clip.effects) : (clip.props as Record<string, unknown>)[key]);

export const sameValue = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function patched(doc: MotionDoc, clip: MotionClip, patch: Record<string, unknown>): OpResult {
  const { [EFFECTS_KEY]: effects, ...props } = patch;
  const withProps = Object.keys(props).length ? setProps(doc, clip.id, props) : { ok: true as const, doc };
  return effects && withProps.ok ? effectsApplied(withProps.doc, clip.id, effects as Effect[]) : withProps;
}

function followed(clip: MotionClip, style: Style, before: Style | undefined): Record<string, unknown> {
  const next = stylePatch(clip, style);
  if (!before || before.kind !== style.kind) {
    return next;
  }
  const prior = stylePatch(clip, before);
  return Object.fromEntries(Object.entries(next).filter(([key]) => !(key in prior) || sameValue(currentOf(clip, key), prior[key])));
}

function linked(doc: MotionDoc, name: string): string[] {
  return doc.tracks.flatMap((t) => t.clips.filter((c) => SLOTS.some((slot) => c[slot] === name)).map((c) => c.id));
}

function withRef(doc: MotionDoc, ids: readonly string[], slot: StyleSlot, name: string | undefined): MotionDoc {
  const pick = new Set(ids);
  const tracks = doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (pick.has(c.id) ? { ...c, [slot]: name } : c)) }));
  return { ...doc, tracks };
}

function withoutRefs(doc: MotionDoc, ids: readonly string[], slots: readonly StyleSlot[]): MotionDoc {
  return slots.reduce((next, slot) => withRef(next, ids, slot, undefined), doc);
}

function paint(doc: MotionDoc, ids: readonly string[], style: Style, before?: Style): OpResult {
  let next = doc;
  for (const id of ids) {
    const found = findClip(next, id);
    if (!found) {
      return { ok: false, error: `no clip ${id}` };
    }
    const refusal = REFUSAL[style.kind](found.clip.component);
    if (refusal) {
      return { ok: false, error: `${id}: ${refusal}` };
    }
    const r = patched(next, found.clip, followed(found.clip, style, before));
    if (!r.ok) {
      return r;
    }
    next = r.doc;
  }
  return { ok: true, doc: next };
}

export function stylesOf(doc: MotionDoc): NamedStyle[] {
  return Object.entries(doc.styles ?? {}).map(([name, style]) => ({ name, style, clips: linked(doc, name) }));
}

export function defineStyle(doc: MotionDoc, name: string, input: unknown): OpResult {
  const parsed = styleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const styles = { ...(doc.styles ?? {}), [name]: parsed.data };
  const checked = stylesSchema.safeParse(styles);
  if (!checked.success) {
    return { ok: false, error: checked.error.issues[0].message };
  }
  const style = parsed.data;
  const before = doc.styles?.[name];
  return inEveryScope({ ...doc, styles }, (view, rootUnit) => paint(view, linked(view, name), inScope(style, rootUnit), before && inScope(before, rootUnit)));
}

const inScope = (style: Style, rootUnit: number): Style => (style.kind === StyleKind.Text && style.size !== undefined ? { ...style, size: style.size * rootUnit } : style);

export function applyStyle(doc: MotionDoc, ids: readonly string[], name: string): OpResult {
  const style = doc.styles?.[name];
  if (!style) {
    const known = Object.keys(doc.styles ?? {});
    return { ok: false, error: `no style ${name}${known.length ? `: this video has ${known.join(', ')}` : ''}` };
  }
  const painted = paint(doc, ids, style);
  return painted.ok ? { ok: true, doc: withRef(painted.doc, ids, SLOT_OF[style.kind], name) } : painted;
}

export function detachStyle(doc: MotionDoc, ids: readonly string[], slot?: StyleSlot): OpResult {
  return { ok: true, doc: withoutRefs(doc, ids, slot ? [slot] : SLOTS) };
}

export function removeStyle(doc: MotionDoc, name: string): OpResult {
  if (!doc.styles?.[name]) {
    return { ok: false, error: `no style ${name}` };
  }
  const { [name]: _gone, ...styles } = doc.styles;
  return { ok: true, doc: { ...withoutRefs(doc, linked(doc, name), SLOTS), styles } };
}

function renamedRefs(clip: MotionClip, from: string, to: string): MotionClip {
  return SLOTS.reduce((next, slot) => (next[slot] === from ? { ...next, [slot]: to } : next), clip);
}

export function renameStyle(doc: MotionDoc, from: string, to: string): OpResult {
  const style = doc.styles?.[from];
  if (!style) {
    return { ok: false, error: `no style ${from}` };
  }
  if (!STYLE_NAME.test(to)) {
    return { ok: false, error: 'style names are letters, digits, spaces, - or _' };
  }
  if (doc.styles?.[to]) {
    return { ok: false, error: `a style ${to} already exists` };
  }
  const { [from]: _old, ...others } = doc.styles ?? {};
  const tracks = doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => renamedRefs(c, from, to)) }));
  return { ok: true, doc: { ...doc, tracks, styles: { ...others, [to]: style } } };
}

const TEXT_PROPS = ['font', 'size', 'weight', 'tracking', 'leading', 'textCase', 'color'] as const;

function colourOf(props: Record<string, unknown>): unknown {
  const fills = props.fills as { color?: string }[] | undefined;
  return props.color ?? fills?.find((f) => f.color)?.color ?? props.fill;
}

const LOOK_OF: Record<StyleKind, (clip: MotionClip) => Record<string, unknown>> = {
  [StyleKind.Text]: (clip) => ({ kind: StyleKind.Text, ...Object.fromEntries(TEXT_PROPS.filter((k) => clip.props[k] !== undefined).map((k) => [k, clip.props[k]])) }),
  [StyleKind.Colour]: (clip) => ({ kind: StyleKind.Colour, color: colourOf(clip.props) }),
  [StyleKind.Paint]: (clip) => ({ kind: StyleKind.Paint, fills: elementFills(clip.component, clip.props) }),
  [StyleKind.Effect]: (clip) => ({ kind: StyleKind.Effect, effects: bare(clip.effects) })
};

export function saveAsStyle(doc: MotionDoc, clipId: string, name: string, kind: StyleKind): OpResult {
  const found = findClip(doc, clipId);
  if (!found) {
    return { ok: false, error: `no clip ${clipId}` };
  }
  const defined = defineStyle(doc, name, LOOK_OF[kind](found.clip));
  return defined.ok ? applyStyle(defined.doc, [clipId], name) : defined;
}

export function stylesFor(doc: MotionDoc, component: ComponentId): NamedStyle[] {
  return stylesOf(doc).filter((s) => REFUSAL[s.style.kind](component) === null);
}
