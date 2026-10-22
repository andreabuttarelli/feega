import { DrawTool } from '$lib/motion/draw-tool';

class FrameBar {
  tool = $state(DrawTool.Select);
  timeline = $state.raw<HTMLElement | null>(null);
}

export const frameBar = new FrameBar();
