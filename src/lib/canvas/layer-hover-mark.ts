import { frameHover, type LayerHover } from './layers';
import type { FramePicker, FrameSpace } from './frame-pick';

type World = { x: number; y: number };

export type LayerHoverMark = { clip: string; quad: [World, World, World, World] };

export function layerHoverMark(hover: LayerHover, openNodeId: string | null, at: { nodeId: string; picker: FramePicker; space: FrameSpace }): LayerHoverMark | null {
  const clip = at.nodeId === openNodeId ? frameHover(hover, openNodeId) : null;
  const quad = clip ? at.picker.outlineQuad(clip, at.space) : null;
  return clip && quad ? { clip, quad } : null;
}
