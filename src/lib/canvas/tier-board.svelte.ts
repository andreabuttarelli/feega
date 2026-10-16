import { getContext, setContext } from 'svelte';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { View } from './live-video';
import type { Tier } from './asset-url';

const BOARD = Symbol('image-tier-board');

export class TierBoard {
  private readonly tiers = new SvelteMap<string, Tier>();
  private readonly seen = new SvelteSet<string>();
  view = $state(View.Readable);

  of(nodeId: string): Tier | null {
    return this.tiers.get(nodeId) ?? null;
  }

  onScreen(nodeId: string): boolean {
    return this.seen.has(nodeId);
  }

  see(ids: Set<string>, view: View): void {
    for (const id of [...this.seen]) {
      if (!ids.has(id)) {
        this.seen.delete(id);
      }
    }
    for (const id of ids) {
      this.seen.add(id);
    }
    this.view = view;
  }

  apply(plan: Map<string, Tier>): void {
    for (const id of [...this.tiers.keys()]) {
      if (!plan.has(id)) {
        this.tiers.delete(id);
      }
    }

    for (const [id, tier] of plan) {
      if (this.tiers.get(id) !== tier) {
        this.tiers.set(id, tier);
      }
    }
  }
}

export function provideTierBoard(): TierBoard {
  return setContext(BOARD, new TierBoard());
}

export function tierBoard(): TierBoard | null {
  return getContext<TierBoard | undefined>(BOARD) ?? null;
}
