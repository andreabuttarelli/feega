import { CUSTOM } from '$lib/canvas/effects';
import type { StoredEffect } from '$lib/server/repos/effects';

export function effectListing(effect: StoredEffect) {
  return {
    effect_id: effect.id,
    name: effect.name,
    version: effect.version,
    params: effect.params,
    state: effect.check.state,
    problems: effect.check.problems,
    cost_ms: effect.check.costMs,
    step: { id: CUSTOM, ref: effect.id }
  };
}
