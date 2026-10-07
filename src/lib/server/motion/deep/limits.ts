import { DeepPhase } from '$lib/motion/deep';
import { DEEP_ITERATIONS } from './budget';

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;

export const DEEP_MAX_DURATION_S = 1800;
export const DEEP_RESERVE_MS = 90 * SECOND_MS;
export const DEEP_DEADLINE_MS = 3 * 60 * MINUTE_MS;
export const DEEP_STALE_MS = 3 * MINUTE_MS;
export const DEEP_BUILD_STEPS = 60;

export const DEEP_PHASE_MS: Record<DeepPhase, number> = {
  [DeepPhase.Storyboard]: 3 * MINUTE_MS,
  [DeepPhase.Assets]: 6 * MINUTE_MS,
  [DeepPhase.Build]: 6 * MINUTE_MS,
  [DeepPhase.Render]: 4 * MINUTE_MS,
  [DeepPhase.Critique]: 3 * MINUTE_MS,
  [DeepPhase.Summary]: MINUTE_MS,
  [DeepPhase.Done]: 0
};

export const DEEP_ROUNDS = { min: DEEP_ITERATIONS.min, max: DEEP_ITERATIONS.max };

export enum StillsEngine {
  Farm = 'farm',
  Machine = 'machine'
}

export enum Runtime {
  Dev = 'dev',
  Deployed = 'deployed'
}

const ENGINE_OF: Record<Runtime, StillsEngine> = { [Runtime.Dev]: StillsEngine.Machine, [Runtime.Deployed]: StillsEngine.Farm };

export const stillsEngine = (runtime: Runtime) => ENGINE_OF[runtime];
