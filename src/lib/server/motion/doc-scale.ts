import type { MotionDoc } from '@feega/motion-core/motion/doc';
import type { CanvasNodeRecord } from '$lib/server/repos/canvas';
import { scaleOf } from '$lib/motion/units';

export function docScaleOf(record: Pick<CanvasNodeRecord, 'size'> | null, doc: Pick<MotionDoc, 'width'>): number {
  const { width, height } = record?.size ?? {};
  return scaleOf(doc, width && height ? { w: width, h: height } : null);
}
