import { describe, expect, it } from 'vitest';
import { Ease } from '../design';
import { adjustmentLayer, adjustmentTimeline } from './render';

const frame = { width: 100, height: 100, fps: 30 };
const clip = {
  id: 'a1',
  from: 0,
  durationInFrames: 31,
  effects: [],
  blend: 'normal',
  keyframes: { opacity: [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 30, value: 1, ease: Ease.Linear }] }
};
const same = (c: string) => c;

describe('adjustment strength', () => {
  it('starts at the first opacity keyframe', () => {
    expect(adjustmentLayer(clip, frame, same, '', 1)).toMatch(/opacity:0[;"]/);
  });

  it('follows the opacity keyframes over the clip', () => {
    const sets = adjustmentTimeline(clip, frame, same).filter((s) => 'opacity' in s.vars);
    expect(sets.at(-1)?.vars.opacity).toBe(1);
    expect(sets.find((s) => s.vars.opacity === 0.5)).toBeDefined();
  });
});
