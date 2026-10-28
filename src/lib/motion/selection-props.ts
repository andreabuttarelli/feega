import { findClip, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import type { EditMode } from './edit-mode';
import { scaleAround } from './group-transform';
import { Horizontal, Vertical } from '@feega/motion-core/motion/constraints/model';
import { MIXED, shared, type Shared } from './mixed';
import type { Bounds } from './scene-select';
import { moveBy } from './space';
import { setProps, type OpResult } from '@feega/motion-core/motion/timeline';
import { Control, Group } from '@feega/motion-core/motion/components';
import { fieldsOf, type Field } from './inspector';

const SIMPLE_CONTROLS: ReadonlySet<Control> = new Set([Control.Color, Control.Range, Control.Select, Control.Toggle, Control.Font, Control.Text]);

const declares = (clip: MotionClip, field: Field) => fieldsOf(clip.component).some((f) => f.key === field.key && f.control === field.control);

export type SharedField = { field: Field; value: Shared<unknown> };

export function sharedFields(clips: readonly MotionClip[]): SharedField[] {
  const [first, ...rest] = clips;
  if (!first) {
    return [];
  }
  return fieldsOf(first.component)
    .filter((field) => field.group === Group.Style && SIMPLE_CONTROLS.has(field.control) && rest.every((clip) => declares(clip, field)))
    .map((field) => ({ field, value: shared(clips.map((clip) => clip.props[field.key] ?? field.fallback)) }));
}

const CONSTRAINT_DEFAULT = { horizontal: Horizontal.Scale, vertical: Vertical.Scale } as const;

export const sharedConstraint = (clips: readonly MotionClip[], axis: keyof typeof CONSTRAINT_DEFAULT) => shared(clips.map((c) => c.constraints?.[axis] ?? CONSTRAINT_DEFAULT[axis]));

export type BoxPatch = Partial<{ x: number; y: number; width: number; height: number }>;

const owners = (clips: readonly MotionClip[], key: string) => clips.filter((c) => c.props[key] !== undefined);

export function sharedProp(clips: readonly MotionClip[], key: string): Shared<unknown> {
  const own = owners(clips, key);
  return own.length ? shared(own.map((c) => c.props[key])) : MIXED;
}

export function setPropAcross(doc: MotionDoc, ids: readonly string[], key: string, value: unknown): OpResult {
  const own = ids.flatMap((id) => findClip(doc, id)?.clip ?? []).filter((c) => c.props[key] !== undefined || fieldsOf(c.component).some((f) => f.key === key));
  if (!own.length) {
    return { ok: false, error: `no selected clip has ${key}` };
  }
  return own.reduce<OpResult>((r, clip) => (r.ok ? setProps(r.doc, clip.id, { [key]: value }) : r), { ok: true, doc });
}

export function placeBox(doc: MotionDoc, ids: readonly string[], frame: number, current: Bounds, patch: BoxPatch, mode: EditMode): OpResult {
  const width = current.right - current.left;
  const height = current.bottom - current.top;
  const factor = patch.width !== undefined && width > 0 ? patch.width / width : patch.height !== undefined && height > 0 ? patch.height / height : 1;
  const scaled = factor === 1 ? { ok: true as const, doc } : scaleAround(doc, ids, frame, [current.left, current.top], factor, mode);
  if (!scaled.ok) {
    return scaled;
  }
  return moveBy(scaled.doc, ids, frame, [(patch.x ?? current.left) - current.left, (patch.y ?? current.top) - current.top], mode);
}
