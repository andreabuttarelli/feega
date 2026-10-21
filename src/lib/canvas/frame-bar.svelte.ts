import { DrawTool } from '$lib/motion/draw-tool';
import { EditMode } from '$lib/motion/edit-mode';

export enum FrameAction {
  Image = 'image',
  Library = 'library'
}

type Host = { act: (action: FrameAction) => void };

class FrameBar {
  tool = $state(DrawTool.Select);
  timeline = $state.raw<HTMLElement | null>(null);
  sidePx = $state(0);
  host = $state.raw<Host | null>(null);
  covered = $state(false);
  editMode = $state(EditMode.Design);

  attach(host: Host) {
    this.host = host;
    return () => {
      if (this.host === host) {
        this.host = null;
        this.timeline = null;
        this.sidePx = 0;
        this.tool = DrawTool.Select;
        this.covered = false;
        this.editMode = EditMode.Design;
      }
    };
  }
}

export const frameBar = new FrameBar();
