import { findClip, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { setProps, type OpResult } from '@feega/motion-core/motion/timeline';
import { aabb, quadOf, type Bounds } from './scene-select';
import { placeBox } from './selection-props';
import { propBoxes } from './space';
import { toStored } from './units';
import { MIXED, shared, type Shared } from './mixed';
import type { EditMode } from './edit-mode';

export enum BoxKey {
  X = 'x',
  Y = 'y',
  Width = 'width',
  Height = 'height'
}

export const BOX_FIELDS: readonly { key: BoxKey; label: string; name: string }[] = [
  { key: BoxKey.X, label: 'X', name: 'X' },
  { key: BoxKey.Y, label: 'Y', name: 'Y' },
  { key: BoxKey.Width, label: 'W', name: 'Width' },
  { key: BoxKey.Height, label: 'H', name: 'Height' }
];

const READ: Record<BoxKey, (b: Bounds) => number> = {
  [BoxKey.X]: (b) => b.left,
  [BoxKey.Y]: (b) => b.top,
  [BoxKey.Width]: (b) => b.right - b.left,
  [BoxKey.Height]: (b) => b.bottom - b.top
};

const MOVES: ReadonlySet<BoxKey> = new Set([BoxKey.X, BoxKey.Y]);
const HUNDREDTHS = 100;

export type LayerBox = { id: string; bounds: Bounds };

export function layerBoxes(doc: MotionDoc, ids: readonly string[], frame: number): LayerBox[] {
  const boxes = propBoxes(doc);
  return ids.filter((id) => boxes[id] && findClip(doc, id)).map((id) => ({ id, bounds: aabb(quadOf(doc, id, frame, boxes[id])) }));
}

export const boxValue = (placed: readonly LayerBox[], key: BoxKey): Shared<number> => shared(placed.map((p) => Math.round(READ[key](p.bounds) * HUNDREDTHS) / HUNDREDTHS));

function placeOne(doc: MotionDoc, clip: MotionClip, at: LayerBox, key: BoxKey, value: number, frame: number, mode: EditMode): OpResult {
  if (!MOVES.has(key) && typeof clip.props[key] === 'number') {
    return setProps(doc, clip.id, { [key]: toStored(clip.component, key, value, doc) });
  }
  return placeBox(doc, [clip.id], frame, at.bounds, { [key]: value }, mode);
}

export function setLayerBox(doc: MotionDoc, placed: readonly LayerBox[], key: BoxKey, value: number, frame: number, mode: EditMode): OpResult {
  let result: OpResult = { ok: true, doc };
  for (const at of placed) {
    if (!result.ok) {
      return result;
    }
    const clip = findClip(result.doc, at.id)?.clip;
    if (!clip) {
      continue;
    }
    result = placeOne(result.doc, clip, at, key, value, frame, mode);
  }
  return result;
}
