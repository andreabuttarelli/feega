import { CUSTOM } from '$lib/canvas/effects';
import { SHADER_LIBRARY } from '@feega/shader-fx/library';
import { CheckState, type StoredEffect } from '$lib/server/repos/effects';

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

const LIBRARY_PREFIX = 'library-';
const LIBRARY_VERSION = 1;
const LIBRARY_STAMP = '2026-11-16T00:00:00.000Z';

export const libraryEffects = (): StoredEffect[] =>
  SHADER_LIBRARY.map((s) => ({
    id: `${LIBRARY_PREFIX}${s.name}`,
    name: s.name,
    version: LIBRARY_VERSION,
    frag: s.frag,
    params: s.params,
    check: { state: CheckState.Passed, problems: [], costMs: null },
    updatedAt: LIBRARY_STAMP
  }));
