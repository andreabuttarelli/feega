import { Background, type MotionDoc } from '@feega/motion-core/motion/doc';
import { docMode, type DocMode } from '@feega/motion-core/motion/still';
import { FrameKind, elementNodeOf, frameNodeOf, leftEmpty, type DocNodeType } from '$lib/canvas/motion-node';
import { blankElement, canvasReady } from './draw-create';
import { elementName } from './element-name';
import { homed, placeInstance } from './canvas-components';
import { DropOn, clipCentre, elementBox, frameOf, liftElement, placeElement, type Box, type Drop, type Element, type NewId, type Point } from './move-element';

export enum MoveOutcome {
  Done = 'done',
  NotFound = 'motion_node_not_found',
  NoElement = 'element_not_found',
  SameFrame = 'same_frame',
  NoOutput = 'no_output',
  Conflict = 'conflict',
  Invalid = 'invalid'
}

export type Stage = { width: number; height: number };
export type FrameSnap = { nodeId: string; doc: MotionDoc; kind?: FrameKind; stage?: Stage };
export type NodeShape = { type: DocNodeType; data: Record<string, unknown>; width: number; height: number; displayName?: string };
export type FrameDrop = Extract<Drop, { on: DropOn.Frame }>;
export type CanvasDrop = Extract<Drop, { on: DropOn.Canvas }>;

export type InFrame = { on: DropOn.Frame; nodeId: string; doc: MotionDoc; clipId: string };
export type OnCanvas = { on: DropOn.Canvas; at: Point; doc: MotionDoc; clipId: string; shape: NodeShape };
export type Landing = InFrame | OnCanvas;

export enum Left {
  Kept = 'kept',
  Written = 'written',
  Removed = 'removed'
}

export type SourceLeft = { left: Left.Kept } | { left: Left.Written; doc: MotionDoc } | { left: Left.Removed };

export type Refusal = { ok: false; outcome: Exclude<MoveOutcome, MoveOutcome.Done>; detail?: string };
export type LandingPlan = { ok: true; landing: Landing } | Refusal;
export type MovePlan = { ok: true; landing: Landing; source: SourceLeft } | Refusal;
export type MoveAskPlan = { clipId: string; drop: Drop; box?: Box | null };

export enum StillAt {
  Kept = 'kept',
  Settled = 'settled'
}

const STILL_AT: Record<StillAt, (doc: MotionDoc) => MotionDoc> = { [StillAt.Kept]: (doc) => doc, [StillAt.Settled]: canvasReady };

export const refusal = (outcome: Refusal['outcome'], detail?: string): Refusal => ({ ok: false, outcome, detail });

export function idsFrom(ids: readonly string[], fallback: NewId): NewId {
  const queue = [...ids];
  return () => queue.shift() ?? fallback();
}

const firstClip = (doc: MotionDoc, fallback: string) => doc.tracks.flatMap((t) => t.clips)[0]?.id ?? fallback;

export function seenAt(element: Element, from: FrameSnap, to: FrameSnap): Element {
  if (!from.stage || !to.stage) {
    return element;
  }
  return { ...element, size: { width: (to.doc.width * from.stage.width) / to.stage.width, height: (to.doc.height * from.stage.height) / to.stage.height } };
}

function atCanvasPixels(element: Element, area: Box, node: { w: number; h: number }): Element {
  const sheet = blankElement({ left: 0, top: 0, width: node.w, height: node.h });
  if (!sheet.ok || element.size.width * area.width >= sheet.doc.width) {
    return element;
  }
  return { ...element, size: { width: sheet.doc.width / area.width, height: sheet.doc.height / area.height } };
}

export function landIn(target: FrameSnap, element: Element, drop: FrameDrop, newId: NewId): LandingPlan {
  const placed = placeElement(target.doc, element, { at: drop.at, frame: drop.frame }, newId);
  if (!placed.ok) {
    return refusal(MoveOutcome.Invalid, placed.error);
  }
  return { ok: true, landing: { on: DropOn.Frame, nodeId: target.nodeId, doc: placed.doc, clipId: placed.clipId } };
}

export function landOnCanvas(element: Element, drop: CanvasDrop, mode: DocMode, box: Box | null, newId: NewId): OnCanvas {
  const doc = frameOf(element, mode, box, newId);
  const shaped = frameNodeOf(doc);
  return { on: DropOn.Canvas, at: { x: drop.x, y: drop.y }, doc, clipId: firstClip(doc, element.clip.id), shape: { type: shaped.type, data: shaped.data, width: shaped.w, height: shaped.h } };
}

export function landFree(element: Element, drop: CanvasDrop, mode: DocMode, box: Box | null, stage: Stage, newId: NewId, stillAt: StillAt = StillAt.Kept): OnCanvas {
  const area = box ?? elementBox(element);
  const shaped = elementNodeOf({ width: area.width * stage.width, height: area.height * stage.height });
  const at = { x: drop.x - shaped.w / 2, y: drop.y - shaped.h / 2 };
  const doc = STILL_AT[stillAt]({ ...frameOf(atCanvasPixels(element, area, shaped), mode, area, newId), background: Background.Transparent });
  return { on: DropOn.Canvas, at, doc, clipId: firstClip(doc, element.clip.id), shape: { type: shaped.type, data: shaped.data, width: shaped.w, height: shaped.h, displayName: elementName(element.clip) } };
}

function landOut(source: FrameSnap, element: Element, drop: CanvasDrop, box: Box | null, newId: NewId): OnCanvas {
  const mode = docMode(source.doc);
  return source.stage ? landFree(element, drop, mode, box, source.stage, newId) : landOnCanvas(element, drop, mode, box, newId);
}

function landElsewhere(source: FrameSnap, target: FrameSnap | null, element: Element, ask: MoveAskPlan, newId: NewId): LandingPlan {
  if (target && ask.drop.on === DropOn.Frame) {
    return landIn(target, seenAt(element, source, target), ask.drop, newId);
  }
  if (ask.drop.on === DropOn.Canvas) {
    return { ok: true, landing: landOut(source, element, ask.drop, ask.box ?? null, newId) };
  }
  return refusal(MoveOutcome.NotFound, `no frame ${ask.drop.nodeId}`);
}

export function planMove(source: FrameSnap, target: FrameSnap | null, ask: MoveAskPlan, newId: NewId): MovePlan {
  if (ask.drop.on === DropOn.Frame && ask.drop.nodeId === source.nodeId) {
    return refusal(MoveOutcome.SameFrame);
  }
  const lifted = liftElement(source.doc, ask.clipId);
  if (!lifted.ok) {
    return refusal(MoveOutcome.NoElement, lifted.error);
  }
  const landed = landElsewhere(source, target, lifted.element, ask, newId);
  if (!landed.ok) {
    return landed;
  }
  const emptied = leftEmpty(source.kind ?? FrameKind.Frame, lifted.doc);
  return { ok: true, landing: landed.landing, source: emptied ? { left: Left.Removed } : { left: Left.Written, doc: lifted.doc } };
}

export function planCopy(source: FrameSnap, target: FrameSnap | null, ask: MoveAskPlan, newId: NewId): MovePlan {
  const lifted = liftElement(source.doc, ask.clipId);
  if (!lifted.ok) {
    return refusal(MoveOutcome.NoElement, lifted.error);
  }
  const landed = landElsewhere(source, target, lifted.element, ask, newId);
  return landed.ok ? { ok: true, landing: landed.landing, source: { left: Left.Kept } } : landed;
}

export function planComponent(source: FrameSnap, compId: string, drop: CanvasDrop, newId: NewId): MovePlan {
  const instanceId = newId();
  const from = homed(source.doc, source.nodeId);
  const placed = placeInstance(from, from, compId, () => instanceId);
  if (!placed.ok) {
    return refusal(MoveOutcome.Invalid, placed.error);
  }
  const lifted = liftElement(placed.doc, instanceId);
  if (!lifted.ok) {
    return refusal(MoveOutcome.NoElement, lifted.error);
  }
  return { ok: true, landing: landOut(source, lifted.element, drop, null, newId), source: { left: Left.Kept } };
}

export function planFree(source: FrameSnap, target: FrameSnap, drop: FrameDrop, newId: NewId): LandingPlan {
  const spread = (axis: 'x' | 'y', size: 'width' | 'height', centre: number) => drop.at[axis] + ((centre - 0.5) * (source.stage?.[size] ?? 0)) / (target.stage?.[size] ?? 1);
  let doc = target.doc;
  let clipId = '';
  for (const clip of source.doc.tracks.flatMap((t) => t.clips)) {
    const lifted = liftElement(source.doc, clip.id);
    if (!lifted.ok) {
      return refusal(MoveOutcome.NoElement, lifted.error);
    }
    const centre = clipCentre(clip);
    const placed = placeElement(doc, seenAt(lifted.element, source, target), { at: { x: spread('x', 'width', centre.x), y: spread('y', 'height', centre.y) }, frame: drop.frame }, newId);
    if (!placed.ok) {
      return refusal(MoveOutcome.Invalid, placed.error);
    }
    doc = placed.doc;
    clipId = placed.clipId;
  }
  return { ok: true, landing: { on: DropOn.Frame, nodeId: target.nodeId, doc, clipId } };
}
