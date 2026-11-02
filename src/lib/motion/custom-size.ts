import { MAX_SHORT_SIDE, MAX_SIDE, MIN_SIDE, sideRange, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import type { CanvasSize, OpResult } from '@feega/motion-core/motion/timeline';
import { Horizontal, Vertical, resizeFrame } from './constraints/constraints';
import { keepTextSize, resizedFreeText } from './text-fit';
import { stackElementResized } from './layout/stack-fit';
import { heldPixels } from '@feega/motion-core/motion/breakpoints/model';

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

const constrainedFit = (doc: MotionDoc, node: CanvasSize): OpResult => {
  const sized = resizeFrame(doc, customSize(node, doc));
  return sized.ok && doc.still ? { ok: true, doc: heldPixels(sized.doc, doc) } : sized;
};

const elementStage = (doc: MotionDoc, node: CanvasSize, was?: CanvasSize): CanvasSize =>
  customSize(was ? { width: (doc.width * node.width) / was.width, height: (doc.height * node.height) / was.height } : node, doc);

const FIT_BY_MODE: Record<ResizeMode, (doc: MotionDoc, node: CanvasSize, was?: CanvasSize) => OpResult> = {
  [ResizeMode.Constrained]: constrainedFit,
  [ResizeMode.Ignored]: (doc, node) => fittedWith(doc, node, STAYS_PUT),
  [ResizeMode.Element]: (doc, node, was) => fitElementToNode(keepTextSize(doc, doc, elementStage(doc, node, was)), node, was)
};

export const fitToNode = (doc: MotionDoc, node: CanvasSize, mode: ResizeMode = ResizeMode.Constrained, was?: CanvasSize): OpResult => FIT_BY_MODE[mode](doc, node, was);

export function handResized(doc: MotionDoc, was: CanvasSize, node: CanvasSize): OpResult {
  const sized = resizedFreeText(doc, { width: was.width !== node.width, height: was.height !== node.height }) ?? doc;
  return fitElementToNode(keepTextSize(sized, was, node), node, was);
}

export function fitElementToNode(doc: MotionDoc, node: CanvasSize, was?: CanvasSize): OpResult {
  const stack = stackElementResized(doc, elementStage(doc, node, was));
  return stack ? { ok: true, doc: stack } : fittedWith(doc, node, SCALES_WITH_NODE);
}
