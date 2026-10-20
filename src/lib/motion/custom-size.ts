import { MAX_SHORT_SIDE, MAX_SIDE, MIN_SIDE, sideRange, type MotionDoc } from './doc';
import type { CanvasSize, OpResult } from './timeline';
import { resizeFrame } from './constraints/constraints';

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

export const fitToNode = (doc: MotionDoc, node: CanvasSize): OpResult => resizeFrame(doc, customSize(node, doc));
