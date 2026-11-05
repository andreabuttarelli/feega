import { Ease } from '@feega/motion-core/motion/design';
import type { Keyframe } from '@feega/motion-core/motion/keyframes';

export type MotionSample = { at: number; dx: number; dy: number; rotate: number; scale: number; opacity: number };

export type CapturedMotion = { durationMs: number; delayMs: number; loop: boolean; samples: MotionSample[] };

export type Stage = { fps: number; durationInFrames: number; width: number; height: number };

const MS_PER_SECOND = 1000;
const MAX_KEYS = 600;
const STILL = 1e-4;

type Channel = { key: string; of: (s: MotionSample) => number; toDoc: (v: number, base: { x: number; y: number }, unitsPerPx: number, stage: Stage) => number };

const CHANNELS: Channel[] = [
  { key: 'x', of: (s) => s.dx, toDoc: (v, base, k, stage) => base.x + (v * k) / stage.width },
  { key: 'y', of: (s) => s.dy, toDoc: (v, base, k, stage) => base.y + (v * k) / stage.height },
  { key: 'rotateZ', of: (s) => s.rotate, toDoc: (v) => v },
  { key: 'scale', of: (s) => s.scale, toDoc: (v) => v },
  { key: 'opacity', of: (s) => s.opacity, toDoc: (v) => v }
];

const framesOf = (ms: number, fps: number) => Math.round((ms / MS_PER_SECOND) * fps);

function valueAt(samples: MotionSample[], at: number, of: Channel['of']): number {
  const after = samples.findIndex((s) => s.at >= at);
  if (after <= 0) {
    return of(samples[Math.max(0, after)]);
  }

  const [a, b] = [samples[after - 1], samples[after]];
  const t = b.at === a.at ? 1 : (at - a.at) / (b.at - a.at);
  return of(a) + (of(b) - of(a)) * t;
}

function cycleKeys(samples: MotionSample[], start: number, cycle: number, last: boolean, of: Channel['of']): { frame: number; value: number }[] {
  const inner = samples.filter((s) => s.at < 1 || last).map((s) => ({ frame: start + Math.round(s.at * cycle), value: of(s) }));
  if (last) {
    return inner;
  }
  return [...inner, { frame: start + cycle - 1, value: valueAt(samples, (cycle - 1) / cycle, of) }];
}

function timeline(motion: CapturedMotion, stage: Stage, of: Channel['of']): { frame: number; value: number }[] {
  const start = framesOf(motion.delayMs, stage.fps);
  const cycle = Math.max(1, framesOf(motion.durationMs, stage.fps));
  if (!motion.loop) {
    return cycleKeys(motion.samples, start, cycle, true, of);
  }

  const keys: { frame: number; value: number }[] = [];
  for (let at = start; at < stage.durationInFrames && keys.length < MAX_KEYS; at += cycle) {
    keys.push(...cycleKeys(motion.samples, at, cycle, false, of));
  }
  return keys.filter((k) => k.frame < stage.durationInFrames);
}

const moves = (motion: CapturedMotion, of: Channel['of']) => motion.samples.some((s) => Math.abs(of(s) - of(motion.samples[0])) > STILL);

export function motionKeyframes(motion: CapturedMotion, base: { x: number; y: number }, unitsPerPx: number, stage: Stage): Record<string, Keyframe[]> {
  const keys: Record<string, Keyframe[]> = {};
  for (const channel of CHANNELS) {
    if (!motion.samples.length || !moves(motion, channel.of)) {
      continue;
    }

    const unique = new Map(timeline(motion, stage, channel.of).map((k) => [k.frame, k.value]));
    keys[channel.key] = [...unique].map(([frame, value]) => ({ frame, value: channel.toDoc(value, base, unitsPerPx, stage), ease: Ease.Linear }));
  }
  return keys;
}
