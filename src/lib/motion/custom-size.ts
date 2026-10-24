import { MAX_SHORT_SIDE, MAX_SIDE, MIN_SIDE, sideRange, type MotionClip, type MotionDoc } from './doc';
import type { CanvasSize, OpResult } from './timeline';
import { Horizontal, Vertical, resizeFrame } from './constraints/constraints';
import { keepTextSize } from './text-fit';

const evenSide = (n: number) => Math.min(MAX_SIDE, Math.max(MIN_SIDE, Math.round(n / 2) * 2));

function videoSize(node: CanvasSize): CanvasSize {
  const long = Math.max(node.width, node.height);
  const short = Math.min(node.width, node.height);
  const scale = Math.min(1, MAX_SIDE / long, MAX_SHORT_SIDE / short);
  return { width: evenSide(node.width * scale), height: evenSide(node.height * scale) };
}

function stillSize(node: CanvasSize): CanvasSize {
  const { min, max } = sideRange({ still: true });
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  return { width: clamp(node.width), height: clamp(node.height) };
}

export const customSize = (node: CanvasSize, doc: Pick<MotionDoc, 'still'> = {}): CanvasSize => (doc.still ? stillSize(node) : videoSize(node));

export enum ResizeMode {
  Constrained = 'constrained',
  Ignored = 'ignored',
  Element = 'element'
}

const SCALES_WITH_NODE = { horizontal: Horizontal.Scale, vertical: Vertical.Scale };
const STAYS_PUT = { horizontal: Horizontal.Left, vertical: Vertical.Top };

const withConstraintsOf = (doc: MotionDoc, constraintsOf: (clip: MotionClip) => MotionClip['constraints']): MotionDoc => ({ ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, constraints: constraintsOf(c as MotionClip) })) })) });

const fittedWith = (doc: MotionDoc, node: CanvasSize, pinning: MotionClip['constraints']): OpResult => {
  const own = new Map(doc.tracks.flatMap((t) => t.clips.map((c) => [c.id, (c as MotionClip).constraints] as const)));
  const sized = resizeFrame(withConstraintsOf(doc, () => pinning), customSize(node, doc));
  return sized.ok ? { ok: true, doc: withConstraintsOf(sized.doc, (c) => own.get(c.id)) } : sized;
};

const FIT_BY_MODE: Record<ResizeMode, (doc: MotionDoc, node: CanvasSize) => OpResult> = {
  [ResizeMode.Constrained]: (doc, node) => resizeFrame(doc, customSize(node, doc)),
  [ResizeMode.Ignored]: (doc, node) => fittedWith(doc, node, STAYS_PUT),
  [ResizeMode.Element]: (doc, node) => fitElementToNode(keepTextSize(doc, doc, customSize(node, doc)), node)
};

export const fitToNode = (doc: MotionDoc, node: CanvasSize, mode: ResizeMode = ResizeMode.Constrained): OpResult => FIT_BY_MODE[mode](doc, node);

export function fitElementToNode(doc: MotionDoc, node: CanvasSize): OpResult {
  return fittedWith(doc, node, SCALES_WITH_NODE);
}
