import { untrack } from 'svelte';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { MotionPreview } from './motion-preview';

export type LocalDoc = MotionPreview & { clean?: boolean };

const docs = new SvelteMap<string, LocalDoc>();
const inFlight = new SvelteSet<string>();

export type SavedHead = { version: number; doc: unknown };
const heads = new Map<string, SavedHead>();

export const frameDocs = {
  put(nodeId: string, next: LocalDoc) {
    const held = untrack(() => docs.get(nodeId));
    if (held && (held.version > next.version || (held.version === next.version && held.html === next.html && held.clean === next.clean))) {
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
  unsaved(nodeId: string, serverRevision: number): boolean {
    const held = docs.get(nodeId);
    return !!held && (inFlight.has(nodeId) || held.version !== serverRevision);
  },
  saved(nodeId: string, head: SavedHead) {
    const held = heads.get(nodeId);
    if (held && held.version > head.version) {
      return;
    }
    heads.set(nodeId, head);
  },
  headOf(nodeId: string): SavedHead | null {
    return heads.get(nodeId) ?? null;
  },
  latest(nodeId: string, serverRevision: number): LocalDoc | null {
    const held = docs.get(nodeId);
    if (!held || (held.version < serverRevision && !inFlight.has(nodeId))) {
      return null;
    }
    return held;
  }
};

export const posterCurrent = (local: LocalDoc | null): boolean => local === null || local.clean === true;
