import type { MotionDoc } from '$lib/motion/doc';
import type { Box } from '$lib/motion/layout';
import { Grip, dragPatch, writePatch, type Pt } from '$lib/motion/scene-select';
import type { OpResult } from '$lib/motion/timeline';

const NO_SNAP_PX = 0;

export type Drag = { doc: MotionDoc; clipId: string; frame: number; box: Box; grip: Grip; handle: number; from: Pt; to: Pt };

export function dragClip(drag: Drag): OpResult {
  const { patch } = dragPatch({ ...drag, shift: false, snapTargets: [], snapPx: NO_SNAP_PX });
  return writePatch(drag.doc, drag.clipId, drag.frame, patch);
}
