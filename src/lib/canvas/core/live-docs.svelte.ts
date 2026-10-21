import { untrack } from 'svelte';
import type { MotionDoc } from '$lib/motion/doc';
import type { BrandTokens } from '$lib/motion/brand';

export type LiveDoc = { doc: MotionDoc; tokens: BrandTokens; assets: Record<string, string> };

class LiveDocs {
  map = $state(new Map<string, LiveDoc>());

  set(id: string, live: LiveDoc) {
    this.map = new Map(untrack(() => this.map)).set(id, live);
  }

  clear(id: string) {
    const current = untrack(() => this.map);
    if (!current.has(id)) {
      return;
    }
    const next = new Map(current);
    next.delete(id);
    this.map = next;
  }
}

export const liveDocs = new LiveDocs();
