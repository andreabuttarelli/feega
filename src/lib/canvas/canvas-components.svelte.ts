import { untrack } from 'svelte';
import { componentGroups, type ComponentGroup, type FrameDoc } from '$lib/motion/canvas-components';

const same = (a: readonly FrameDoc[], b: readonly FrameDoc[]) => a.length === b.length && a.every((f, i) => f.id === b[i].id && f.doc === b[i].doc);

class CanvasComponents {
  frames = $state<FrameDoc[]>([]);
  groups = $derived<ComponentGroup[]>(componentGroups(this.frames));

  set(frames: FrameDoc[]) {
    if (!same(untrack(() => this.frames), frames)) {
      this.frames = frames;
    }
  }
}

export const canvasComponents = new CanvasComponents();
