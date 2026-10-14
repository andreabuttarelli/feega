import { DrawTool } from '$lib/motion/draw-tool';

export enum FrameAction {
  Image = 'image',
  Library = 'library'
}

type Host = { act: (action: FrameAction) => void };

class FrameBar {
  tool = $state(DrawTool.Select);
  timelinePx = $state(0);
  sidePx = $state(0);
  host = $state<Host | null>(null);

  attach(host: Host) {
    this.host = host;
    return () => {
      if (this.host === host) {
        this.host = null;
        this.timelinePx = 0;
        this.sidePx = 0;
        this.tool = DrawTool.Select;
      }
    };
  }
}

export const frameBar = new FrameBar();
