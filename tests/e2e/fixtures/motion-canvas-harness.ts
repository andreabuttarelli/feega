import { mount } from 'svelte';
import MotionCanvasHarness from './MotionCanvasHarness.svelte';

export type HarnessNode = { id: string; x: number; y: number; format: string; poster: string };

declare global {
  interface Window {
    motionCanvas: { mount: (nodes: HarnessNode[]) => void };
    selectionEmits?: number;
  }
}

window.motionCanvas = {
  mount: (nodes) => {
    document.body.replaceChildren();
    mount(MotionCanvasHarness, { target: document.body, props: { nodes } });
  }
};
