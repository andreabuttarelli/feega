import { findClip, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { setProps, type OpResult } from '@feega/motion-core/motion/timeline';
import { aabb, quadOf, type Bounds } from './scene-select';
import { placeBox } from './selection-props';
import { propBoxes } from './space';
import { toStored } from './units';
import { resizeInstance } from './instance-resize';
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

function unionOf(placed: readonly LayerBox[]): Bounds {
  return {
    left: Math.min(...placed.map((p) => p.bounds.left)),
    top: Math.min(...placed.map((p) => p.bounds.top)),
    right: Math.max(...placed.map((p) => p.bounds.right)),
    bottom: Math.max(...placed.map((p) => p.bounds.bottom))
  };
}

export const boxValue = (placed: readonly LayerBox[], key: BoxKey): Shared<number> => (placed.length ? Math.round(READ[key](unionOf(placed)) * HUNDREDTHS) / HUNDREDTHS : MIXED);

function placeOne(doc: MotionDoc, clip: MotionClip, at: LayerBox, key: BoxKey, value: number, frame: number, mode: EditMode): OpResult {
  const instance = !!doc.comps[String(clip.props.comp)]?.component;
  if (!MOVES.has(key) && typeof clip.props[key] === 'number' && !instance) {
    return setProps(doc, clip.id, { [key]: toStored(clip.component, key, value, doc) });
  }
  const resized = instance && !MOVES.has(key) ? resizeInstance(doc, clip.id, { width: READ[BoxKey.Width](at.bounds), height: READ[BoxKey.Height](at.bounds) }, { [key]: value }) : null;
  if (resized) {
    return resized;
  }
  return placeBox(doc, [clip.id], frame, at.bounds, { [key]: value }, mode);
}

type Axis = { start: BoxKey; size: BoxKey; from: (b: Bounds) => number };

const AXIS_OF: Record<BoxKey, Axis> = {
  [BoxKey.X]: { start: BoxKey.X, size: BoxKey.Width, from: (b) => b.left },
  [BoxKey.Width]: { start: BoxKey.X, size: BoxKey.Width, from: (b) => b.left },
  [BoxKey.Y]: { start: BoxKey.Y, size: BoxKey.Height, from: (b) => b.top },
  [BoxKey.Height]: { start: BoxKey.Y, size: BoxKey.Height, from: (b) => b.top }
};

function placeEach(doc: MotionDoc, placed: readonly LayerBox[], plan: (at: LayerBox) => [BoxKey, number][], frame: number, mode: EditMode): OpResult {
  let result: OpResult = { ok: true, doc };
  for (const at of placed) {
    for (const [key, value] of plan(at)) {
      const clip = result.ok ? findClip(result.doc, at.id)?.clip : null;
      const now = result.ok ? layerBoxes(result.doc, [at.id], frame)[0] : null;
      if (!result.ok || !clip || !now) {
        return result;
      }
      result = placeOne(result.doc, clip, now, key, value, frame, mode);
    }
  }
  return result;
}

function selectionPlan(placed: readonly LayerBox[], key: BoxKey, value: number): (at: LayerBox) => [BoxKey, number][] {
  const axis = AXIS_OF[key];
  const union = unionOf(placed);
  const start = axis.from(union);
  if (key === axis.start) {
    return (at) => [[axis.start, axis.from(at.bounds) + value - start]];
  }
  const ratio = value / (READ[axis.size](union) || 1);
  return (at) => [
    [axis.size, READ[axis.size](at.bounds) * ratio],
    [axis.start, start + (axis.from(at.bounds) - start) * ratio]
  ];
}

export function setLayerBox(doc: MotionDoc, placed: readonly LayerBox[], key: BoxKey, value: number, frame: number, mode: EditMode): OpResult {
  const plan = placed.length > 1 ? selectionPlan(placed, key, value) : (): [BoxKey, number][] => [[key, value]];
  return placeEach(doc, placed, plan, frame, mode);
}
