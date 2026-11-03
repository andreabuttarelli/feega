import { DrawTool } from '$lib/motion/draw-tool';

class FrameBar {
  tool = $state(DrawTool.Select);
  timeline = $state.raw<HTMLElement | null>(null);

  disarm(): boolean {
    if (this.tool === DrawTool.Select) {
      return false;
    }
    this.tool = DrawTool.Select;
    return true;
  }
}

export const frameBar = new FrameBar();
