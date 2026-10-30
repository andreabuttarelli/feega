import { easeCurve } from '@feega/motion-core/motion/sample-track';
import type { StateRow } from '@feega/motion-core/motion/states/model';

export type TweenRun = { from: number; to: number; startedAt: number; transition: StateRow['transition'] };

export function amountAt(run: TweenRun, now: number): number {
  const elapsed = run.transition.durationMs ? (now - run.startedAt) / run.transition.durationMs : 1;
  const p = Math.min(1, Math.max(0, elapsed));
  return run.from + (run.to - run.from) * easeCurve(run.transition.easing)(p);
}

export const settled = (run: TweenRun, now: number): boolean => now - run.startedAt >= run.transition.durationMs;
