import { DESIGN_MAX_SIDE, MIN_SIDE, sideRange, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import type { CanvasSize, OpResult } from '@feega/motion-core/motion/timeline';
import { Horizontal, Vertical, resizeFrame } from './constraints/constraints';
import { keepTextSize, resizedFreeText } from './text-fit';
import { stackElementResized } from './layout/stack-fit';
import { heldPixels } from '@feega/motion-core/motion/breakpoints/model';

const FRAME_LIMIT_NOTE = `A frame is at most ${DESIGN_MAX_SIDE} px a side: resized to fit`;

const evenSide = (n: number) => Math.min(DESIGN_MAX_SIDE, Math.max(MIN_SIDE, Math.round(n / 2) * 2));

function videoSize(node: CanvasSize): CanvasSize {
  const scale = Math.min(1, DESIGN_MAX_SIDE / Math.max(node.width, node.height));
  return { width: evenSide(node.width * scale), height: evenSide(node.height * scale) };
}

function stillSize(node: CanvasSize): CanvasSize {
  const { min, max } = sideRange({ still: true });
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  return { width: clamp(node.width), height: clamp(node.height) };
}

export const frameSizeNote = (asked: CanvasSize): string | null => (Math.max(asked.width, asked.height) > DESIGN_MAX_SIDE ? FRAME_LIMIT_NOTE : null);

export const customSize = (node: CanvasSize, doc: Pick<MotionDoc, 'still'> = {}): CanvasSize => (doc.still ? stillSize(node) : videoSize(node));

export enum ResizeMode {
  Constrained = 'constrained',
  Ignored = 'ignored',
  Element = 'element'
}

const SCALES_WITH_NODE = { horizontal: Horizontal.Scale, vertical: Vertical.Scale };
const STAYS_PUT = { horizontal: Horizontal.Left, vertical: Vertical.Top };

const withConstraintsOf = (doc: MotionDoc, constraintsOf: (clip: MotionClip) => MotionClip['constraints']): MotionDoc => ({ ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, constraints: constraintsOf(c as MotionClip) })) })) });

const MAX_ROUNDNESS = 0.5;

const shortSide = (props: Record<string, unknown>, doc: CanvasSize) => Math.min(Number(props.width) * doc.width, Number(props.height) * doc.height);

function radiusHeld(clip: MotionClip, before: MotionClip | undefined, from: CanvasSize, to: CanvasSize): MotionClip {
  const props = clip.props as Record<string, unknown>;
  if (!before || clip.parent || typeof props.width !== 'number' || typeof props.height !== 'number') {
    return clip;
  }
  const ratio = shortSide(before.props, from) / shortSide(props, to);
  if (!Number.isFinite(ratio) || ratio === 1) {
    return clip;
  }
  const held = (r: number) => Math.min(MAX_ROUNDNESS, r * ratio);
  const roundness = typeof props.roundness === 'number' ? { roundness: held(props.roundness) } : {};
  const corners = Array.isArray(props.corners) ? { corners: (props.corners as number[]).map(held) } : {};
  return { ...clip, props: { ...props, ...roundness, ...corners } };
}

function heldRadii(doc: MotionDoc, before: MotionDoc): MotionDoc {
  const was = new Map(before.tracks.flatMap((t) => t.clips.map((c) => [c.id, c as MotionClip] as const)));
  return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => radiusHeld(c as MotionClip, was.get(c.id), before, doc)) })) };
}

const kept = (sized: OpResult, before: MotionDoc): OpResult => (sized.ok ? { ok: true, doc: heldRadii(heldPixels(sized.doc, before), before) } : sized);

const fittedWith = (doc: MotionDoc, node: CanvasSize, pinning: MotionClip['constraints']): OpResult => {
  const own = new Map(doc.tracks.flatMap((t) => t.clips.map((c) => [c.id, (c as MotionClip).constraints] as const)));
  const sized = resizeFrame(withConstraintsOf(doc, () => pinning), customSize(node, doc));
  return sized.ok ? { ok: true, doc: withConstraintsOf(sized.doc, (c) => own.get(c.id)) } : sized;
};

const constrainedFit = (doc: MotionDoc, node: CanvasSize): OpResult => kept(resizeFrame(doc, customSize(node, doc)), doc);

const densityKept = (doc: MotionDoc, node: CanvasSize, was?: CanvasSize): CanvasSize => (was?.width && was.height ? { width: (node.width * doc.width) / was.width, height: (node.height * doc.height) / was.height } : node);

const elementStage = (doc: MotionDoc, node: CanvasSize, was?: CanvasSize): CanvasSize =>
  customSize(was ? { width: (doc.width * node.width) / was.width, height: (doc.height * node.height) / was.height } : node, doc);

const FIT_BY_MODE: Record<ResizeMode, (doc: MotionDoc, node: CanvasSize, was?: CanvasSize) => OpResult> = {
  [ResizeMode.Constrained]: (doc, node, was) => constrainedFit(doc, densityKept(doc, node, was)),
  [ResizeMode.Ignored]: (doc, node, was) => kept(fittedWith(doc, densityKept(doc, node, was), STAYS_PUT), doc),
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
