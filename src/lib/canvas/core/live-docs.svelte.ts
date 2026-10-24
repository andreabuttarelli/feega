import { untrack } from 'svelte';
import type { MotionDoc } from '$lib/motion/doc';
import type { BrandTokens } from '$lib/motion/brand';

export type LiveDoc = { doc: MotionDoc; tokens: BrandTokens; assets: Record<string, string>; playhead?: number };

class LiveDocs {
  map = $state(new Map<string, LiveDoc>());
  edits = $state(new Map<string, number>());

  set(id: string, live: LiveDoc) {
    const before = untrack(() => this.map).get(id);
    this.map = new Map(untrack(() => this.map)).set(id, live);
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
