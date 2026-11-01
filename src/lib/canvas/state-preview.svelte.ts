import { untrack } from 'svelte';
import { ElementState } from '@feega/motion-core/motion/states/model';
import type { StatePicks } from '$lib/motion/states/preview';

const NONE: StatePicks = {};

class StatePreview {
  byNode = $state(new Map<string, StatePicks>());

  picksOf(nodeId: string): StatePicks {
    return untrack(() => this.byNode).get(nodeId) ?? NONE;
  }

  stateOf(nodeId: string, clipId: string): ElementState {
    return this.byNode.get(nodeId)?.[clipId]?.state ?? ElementState.Default;
  }

  pick(nodeId: string, clipId: string, state: ElementState) {
    const current = { ...(untrack(() => this.byNode).get(nodeId) ?? {}) };
    if (state === ElementState.Default) {
      delete current[clipId];
    } else {
      current[clipId] = { state, amount: 1 };
    }
    this.byNode = new Map(untrack(() => this.byNode)).set(nodeId, current);
  }
}

export const statePreview = new StatePreview();
