import { findClip, type MotionClip, type MotionDoc } from './doc';
import type { EditMode } from './edit-mode';
import { scaleAround } from './group-transform';
import { MIXED, shared, type Shared } from './mixed';
import type { Bounds } from './scene-select';
import { moveBy } from './space';
import { setProps, type OpResult } from './timeline';

export enum PropKind {
  Colour = 'colour',
  Number = 'number',
  Text = 'text'
}

export const STYLE_PROPS = [
  { key: 'fill', label: 'Fill', kind: PropKind.Colour },
  { key: 'stroke', label: 'Stroke', kind: PropKind.Colour },
  { key: 'strokeWidth', label: 'Stroke width', kind: PropKind.Number },
  { key: 'font', label: 'Font', kind: PropKind.Text },
  { key: 'size', label: 'Font size', kind: PropKind.Number },
  { key: 'weight', label: 'Weight', kind: PropKind.Number }
] as const;

export type BoxPatch = Partial<{ x: number; y: number; width: number; height: number }>;

const owners = (clips: readonly MotionClip[], key: string) => clips.filter((c) => c.props[key] !== undefined);

export function sharedProp(clips: readonly MotionClip[], key: string): Shared<unknown> {
  const own = owners(clips, key);
  return own.length ? shared(own.map((c) => c.props[key])) : MIXED;
}

export function setPropAcross(doc: MotionDoc, ids: readonly string[], key: string, value: unknown): OpResult {
  const own = owners(ids.flatMap((id) => findClip(doc, id)?.clip ?? []), key);
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
