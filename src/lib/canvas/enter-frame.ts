import { Depth, Gesture } from '$lib/motion/drill';
import { frameDrill } from './frame-drill';
import { layersSource } from './layers-source.svelte';

const FRAME_TYPE = 'motion';

export function enterFrame(nodeId: string, type: string | undefined) {
  if (type !== FRAME_TYPE) {
    return;
  }
  frameDrill.request(nodeId, null, Gesture.Enter, Depth.Frame);
  layersSource.canvas?.open(nodeId);
}

export function enterSelected(selected: string[], summaries: Map<string, { type?: string }>) {
  const only = selected.length === 1 ? selected[0] : null;
  if (only) {
    enterFrame(only, summaries.get(only)?.type);
  }
}
