import type { z } from 'zod';
import { findClip, type MotionDoc } from './doc';
import { fieldsOf } from './inspector';
import { FillType } from './fill/model';
import { setProps, type OpResult } from './timeline';
import type { ComponentId } from './components';
import { StyleKind, styleSchema, stylesSchema, type Style, type textStyleSchema, type colourStyleSchema } from './styles-model';

export { StyleKind };

export enum StyleAction {
  Define = 'define',
  Apply = 'apply',
  Detach = 'detach',
  Remove = 'remove',
  List = 'list'
}

export type NamedStyle = { name: string; style: Style; clips: string[] };

const TEXT_KEY = 'font';
const COLOUR_KEY = 'color';
const FILLS_KEY = 'fills';

function keysOf(component: ComponentId): Set<string> {
  return new Set(fieldsOf(component).map((f) => f.key));
}

function textPatch(style: z.infer<typeof textStyleSchema>, keys: Set<string>): Record<string, unknown> | string {
  if (!keys.has(TEXT_KEY)) {
    return 'a text style goes on a text clip';
  }
  const { kind: _kind, ...props } = style;
  return Object.fromEntries(Object.entries(props).filter(([k, v]) => v !== undefined && keys.has(k)));
}

function colourPatch(style: z.infer<typeof colourStyleSchema>, keys: Set<string>): Record<string, unknown> | string {
  if (keys.has(COLOUR_KEY)) {
    return { color: style.color };
  }
  if (keys.has(FILLS_KEY)) {
    return { fills: [{ type: FillType.Solid, color: style.color, opacity: 1, visible: true }] };
  }
  return 'this clip has no colour to style';
}

function patchFor(style: Style, component: ComponentId): Record<string, unknown> | string {
  const keys = keysOf(component);
  return style.kind === StyleKind.Text ? textPatch(style, keys) : colourPatch(style, keys);
}

function linked(doc: MotionDoc, name: string): string[] {
  return doc.tracks.flatMap((t) => t.clips.filter((c) => c.styleRef === name).map((c) => c.id));
}

function withRef(doc: MotionDoc, ids: readonly string[], name: string | undefined): MotionDoc {
  const pick = new Set(ids);
  const tracks = doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (pick.has(c.id) ? { ...c, styleRef: name } : c)) }));
  return { ...doc, tracks };
}

function paint(doc: MotionDoc, ids: readonly string[], style: Style): OpResult {
  let next = doc;
  for (const id of ids) {
    const found = findClip(next, id);
    if (!found) {
      return { ok: false, error: `no clip ${id}` };
    }
    const patch = patchFor(style, found.clip.component);
    if (typeof patch === 'string') {
      return { ok: false, error: `${id}: ${patch}` };
    }
    const r = setProps(next, id, patch);
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
  return painted.ok ? { ok: true, doc: withRef(painted.doc, ids, name) } : painted;
}

export function detachStyle(doc: MotionDoc, ids: readonly string[]): OpResult {
  return { ok: true, doc: withRef(doc, ids, undefined) };
}

export function removeStyle(doc: MotionDoc, name: string): OpResult {
  if (!doc.styles?.[name]) {
    return { ok: false, error: `no style ${name}` };
  }
  const { [name]: _gone, ...styles } = doc.styles;
  return { ok: true, doc: { ...withRef(doc, linked(doc, name), undefined), styles } };
}

const TEXT_PROPS = ['font', 'size', 'weight', 'tracking', 'leading', 'color'] as const;

function colourOf(props: Record<string, unknown>): unknown {
  const fills = props.fills as { color?: string }[] | undefined;
  return props.color ?? fills?.find((f) => f.color)?.color ?? props.fill;
}

function lookOf(props: Record<string, unknown>, kind: StyleKind): Record<string, unknown> {
  if (kind === StyleKind.Colour) {
    return { kind, color: colourOf(props) };
  }
  return { kind, ...Object.fromEntries(TEXT_PROPS.filter((k) => props[k] !== undefined).map((k) => [k, props[k]])) };
}

export function saveAsStyle(doc: MotionDoc, clipId: string, name: string, kind: StyleKind): OpResult {
  const found = findClip(doc, clipId);
  if (!found) {
    return { ok: false, error: `no clip ${clipId}` };
  }
  const defined = defineStyle(doc, name, lookOf(found.clip.props, kind));
  return defined.ok ? applyStyle(defined.doc, [clipId], name) : defined;
}

export function stylesFor(doc: MotionDoc, component: ComponentId): NamedStyle[] {
  return stylesOf(doc).filter((s) => typeof patchFor(s.style, component) !== 'string');
}
