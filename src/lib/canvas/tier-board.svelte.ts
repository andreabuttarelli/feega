import { getContext, setContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import type { Tier } from './asset-url';

const BOARD = Symbol('image-tier-board');

export class TierBoard {
  private readonly tiers = new SvelteMap<string, Tier>();

  of(nodeId: string): Tier | null {
    return this.tiers.get(nodeId) ?? null;
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
