import { clipsOf, type MotionDoc } from '@feega/motion-core/motion/doc';
import type { FrameRect, FrameSize } from '$lib/motion/prototype/hotspots';
import { hasVariantStates } from './variant-states';

export type StateSpot = { clip: string; box: FrameRect };

export function stateSpotsOf(doc: MotionDoc, size: FrameSize, rectOf: (clip: string) => FrameRect | null): StateSpot[] {
  return clipsOf(doc).flatMap((clip) => {
    const rect = clip.states?.length || hasVariantStates(doc, clip.id) ? rectOf(clip.id) : null;
    if (!rect) {
      return [];
    }
    return [{ clip: clip.id, box: { left: rect.left / size.width, top: rect.top / size.height, width: rect.width / size.width, height: rect.height / size.height } }];
  });
}
