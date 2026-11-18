import { untrack } from 'svelte';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import type { BrandTokens } from '@feega/motion-core/motion/brand';
import { traceSinceInput } from './edit-trace';

export type LiveDoc = { doc: MotionDoc; tokens: BrandTokens; assets: Record<string, string>; playhead?: number };

export type LiveListener = (id: string, live: LiveDoc) => void;

const sameLive = (a: LiveDoc | undefined, b: LiveDoc) => a?.doc === b.doc && a.tokens === b.tokens && a.assets === b.assets && a.playhead === b.playhead;

class LiveDocs {
  map = $state(new Map<string, LiveDoc>());
  edits = $state(new Map<string, number>());
  #listeners = new Set<LiveListener>();

  listen(listener: LiveListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  set(id: string, live: LiveDoc) {
    traceSinceInput('edit:to-live-set');
    const before = untrack(() => this.map).get(id);
    if (sameLive(before, live)) {
      return;
    }
    this.map = new Map(untrack(() => this.map)).set(id, live);
    for (const listener of this.#listeners) {
      listener(id, live);
    }
    if (before?.doc === live.doc) {
      return;
    }
    this.edits = new Map(untrack(() => this.edits)).set(id, (untrack(() => this.edits).get(id) ?? 0) + 1);
  }

  clear(id: string) {
    const current = untrack(() => this.map);
    if (!current.has(id)) {
      return;
    }
    const next = new Map(current);
    next.delete(id);
    this.map = next;
    const edits = new Map(untrack(() => this.edits));
    edits.delete(id);
    this.edits = edits;
  }
}

export const liveDocs = new LiveDocs();
