import { frameDiffs, frozenSpans, motionJolts, type Jolt } from '$lib/motion/smoothness';

export const CHECK_MOTION = 'check_motion';
export const CHECK_FRAMES = 24;

const FROZEN_RUN = 6;
const TIME_PRECISION = 10_000;

const at = (seconds: number) => Math.round(seconds * TIME_PRECISION) / TIME_PRECISION;

export function checkTimes(window: { from: number; count: number; fps: number; end: number }): number[] {
  const step = 1 / window.fps;
  const last = window.end - step;
  const from = Math.max(0, Math.min(window.from, last - (window.count - 1) * step));
  return Array.from({ length: window.count }, (_, i) => at(from + i * step));
}

export type MotionCheck = { jolts: { time: number; kind: Jolt }[]; frozen: { from: number; to: number }[]; note: string };

function noteOf(check: Omit<MotionCheck, 'note'>): string {
  const jolts = check.jolts.map((j) => `${j.kind} at ${j.time}s`);
  const frozen = check.frozen.map((f) => `nothing moves from ${f.from}s to ${f.to}s`);
  const found = [...jolts, ...frozen];
  return found.length ? `${found.join('; ')}. A pop or stop is a jolt to fix (an ease that does not settle, a value that jumps); a frozen span is fine only as a planned hold.` : 'Smooth: no jumps, stops or frozen frames in this window.';
}

export function motionCheck(lumas: readonly ArrayLike<number>[], times: readonly number[]): MotionCheck {
  const diffs = frameDiffs(lumas);
  const jolts = motionJolts(diffs).map((j) => ({ time: times[j.frame + 1], kind: j.kind }));
  const frozen = frozenSpans(diffs, FROZEN_RUN).map((s) => ({ from: times[s.from], to: times[s.to] }));
  return { jolts, frozen, note: noteOf({ jolts, frozen }) };
}
