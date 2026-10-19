import { MAX_SHORT_SIDE, MAX_SIDE, MIN_SIDE, type MotionDoc } from './doc';
import type { CanvasSize, OpResult } from './timeline';
import { resizeFrame } from './constraints/constraints';

const evenSide = (n: number) => Math.min(MAX_SIDE, Math.max(MIN_SIDE, Math.round(n / 2) * 2));

export function customSize(node: CanvasSize): CanvasSize {
  const long = Math.max(node.width, node.height);
  const short = Math.min(node.width, node.height);
  const scale = Math.min(MAX_SIDE / long, MAX_SHORT_SIDE / short);
  return { width: evenSide(node.width * scale), height: evenSide(node.height * scale) };
}

export const fitToNode = (doc: MotionDoc, node: CanvasSize): OpResult => resizeFrame(doc, customSize(node));
