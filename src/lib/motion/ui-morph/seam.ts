import { springMath, springSource } from '../spring';
import { reelMath, type ReelPlan } from './reel';

const reel = reelMath(springMath());
const EPS = 1e-6;
const VALUE_TOLERANCE = 1e-3;
const SPEED_TOLERANCE = 1e-2;
const CLOCK = 't';

export function reelSource(): string {
  return `(${reelMath.toString()})(${springSource()})`;
}

const scaleOf = (v: number) => Math.max(1, Math.abs(v));

export function seamProblems(plan: ReelPlan, fps: number): string[] {
  const first = reel.frameAt(plan, 0);
  const last = reel.frameAt(plan, plan.period - EPS);
  const problems: string[] = [];

  for (const channel of Object.keys(first.values).filter((c) => c !== CLOCK)) {
    const scale = scaleOf(first.values[channel]);
    const jump = Math.abs(first.values[channel] - last.values[channel]);
    const kick = Math.abs(first.velocity[channel] - last.velocity[channel]) / fps;
    if (jump > VALUE_TOLERANCE * scale) {
      problems.push(`${channel} jumps by ${jump.toFixed(3)} where the loop closes`);
      continue;
    }
    if (kick > SPEED_TOLERANCE * scale) {
      problems.push(`${channel} changes speed where the loop closes`);
    }
  }

  if (first.typed !== last.typed) {
    problems.push(`the typed text is "${last.typed}" at the end and "${first.typed}" at the start`);
  }
  return problems;
}
