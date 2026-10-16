import { untrack } from 'svelte';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { MotionPreview } from './motion-preview';

const docs = new SvelteMap<string, MotionPreview>();
const inFlight = new SvelteSet<string>();

export const frameDocs = {
  put(nodeId: string, next: MotionPreview) {
    const held = untrack(() => docs.get(nodeId));
    if (held && (held.version > next.version || (held.version === next.version && held.html === next.html))) {
      return;
    }
    docs.set(nodeId, next);
  },
  sending(nodeId: string) {
    inFlight.add(nodeId);
  },
  landed(nodeId: string, base: number, saved: number) {
    inFlight.delete(nodeId);
    const held = untrack(() => docs.get(nodeId));
    if (held?.version !== base) {
      return;
    }
    docs.set(nodeId, { ...held, version: saved });
  },
  latest(nodeId: string, serverRevision: number): MotionPreview | null {
    const held = docs.get(nodeId);
    if (!held || (held.version < serverRevision && !inFlight.has(nodeId))) {
      return null;
    }
    return held;
  }
};

export const posterCurrent = (local: MotionPreview | null): boolean => local === null;
