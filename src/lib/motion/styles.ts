import type { z } from 'zod';
import { findClip, type MotionClip, type MotionDoc } from './doc';
import { fieldsOf } from './inspector';
import { FillType } from './fill/model';
import { FILLED, elementFills } from './fill/elements';
import { effectOfKey, effectsProblem, type Effect } from './effects/model';
import { editClip, setProps, type OpResult } from './timeline';
import { COMPONENTS, TrackKind, type ComponentId } from './components';
import { STYLE_NAME, StyleKind, styleSchema, stylesSchema, type Style, type textStyleSchema, type colourStyleSchema } from './styles-model';

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

function textPatch(style: z.infer<typeof textStyleSchema>, keys: Set<string>): Record<string, unknown> {
  const { kind: _kind, ...props } = style;
  return Object.fromEntries(Object.entries(props).filter(([k, v]) => v !== undefined && keys.has(k)));
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

type StyleOf<K extends StyleKind> = Extract<Style, { kind: K }>;

const APPLY: { [K in StyleKind]: (doc: MotionDoc, clip: MotionClip, style: StyleOf<K>) => OpResult } = {
  [StyleKind.Text]: (doc, clip, style) => setProps(doc, clip.id, textPatch(style, keysOf(clip.component))),
  [StyleKind.Colour]: (doc, clip, style) => setProps(doc, clip.id, colourPatch(style, keysOf(clip.component))),
  [StyleKind.Paint]: (doc, clip, style) => setProps(doc, clip.id, { fills: style.fills }),
  [StyleKind.Effect]: (doc, clip, style) => effectsApplied(doc, clip.id, style.effects)
};

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

function paint(doc: MotionDoc, ids: readonly string[], style: Style): OpResult {
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
    const r = (APPLY[style.kind] as (doc: MotionDoc, clip: MotionClip, style: Style) => OpResult)(next, found.clip, style);
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
  return paint({ ...doc, styles }, linked(doc, name), parsed.data);
}

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
  const { [from]: _old, ...others } = doc.styles;
  const tracks = doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => renamedRefs(c, from, to)) }));
  return { ok: true, doc: { ...doc, tracks, styles: { ...others, [to]: style } } };
}

const TEXT_PROPS = ['font', 'size', 'weight', 'tracking', 'leading', 'color'] as const;

function colourOf(props: Record<string, unknown>): unknown {
  const fills = props.fills as { color?: string }[] | undefined;
  return props.color ?? fills?.find((f) => f.color)?.color ?? props.fill;
}

const LOOK_OF: Record<StyleKind, (clip: MotionClip) => Record<string, unknown>> = {
  [StyleKind.Text]: (clip) => ({ kind: StyleKind.Text, ...Object.fromEntries(TEXT_PROPS.filter((k) => clip.props[k] !== undefined).map((k) => [k, clip.props[k]])) }),
  [StyleKind.Colour]: (clip) => ({ kind: StyleKind.Colour, color: colourOf(clip.props) }),
  [StyleKind.Paint]: (clip) => ({ kind: StyleKind.Paint, fills: elementFills(clip.component, clip.props) }),
  [StyleKind.Effect]: (clip) => ({ kind: StyleKind.Effect, effects: clip.effects.map(({ lut: _lut, ...effect }) => effect) })
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
