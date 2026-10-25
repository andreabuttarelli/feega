import { describe, expect, it } from 'vitest';
import { Ease } from '@feega/motion-core/motion/design';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { animateTo } from './animate-to';
import { addClip, setKeyframes, type OpResult } from '@feega/motion-core/motion/timeline';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const resolve = (c: string) => c;
const base = () => must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 10, durationInFrames: 120 }, 's'));
const keysOf = (doc: MotionDoc, prop: string) => findClip(doc, 's')!.clip.keyframes[prop].map((k) => [k.frame, k.value]);

describe('animateTo', () => {
  it('keys the current value at the start and the target at the end', () => {
    const doc = must(animateTo(base(), 's', { opacity: 0 }, { start: 5, duration: 30 }, resolve));

    expect(keysOf(doc, 'opacity')).toEqual([
      [5, 1],
      [35, 0]
    ]);
  });

  it('animates several props in one go', () => {
    const doc = must(animateTo(base(), 's', { opacity: 0.2, scale: 2 }, { start: 0, duration: 20 }, resolve));

    expect(keysOf(doc, 'opacity')[1]).toEqual([20, 0.2]);
    expect(keysOf(doc, 'scale')).toEqual([
      [0, 1],
      [20, 2]
    ]);
  });

  it('starts from where an existing animation is at that frame', () => {
    const keyed = must(setKeyframes(base(), 's', 'x', [
      { frame: 0, value: 0, ease: Ease.Linear },
      { frame: 60, value: 1, ease: Ease.Linear }
    ]));
    const doc = must(animateTo(keyed, 's', { x: 0 }, { start: 30, duration: 30 }, resolve));

    expect(keysOf(doc, 'x')).toEqual([
      [0, 0],
      [30, 0.5],
      [60, 0]
    ]);
  });

  it('puts the ease on the segment it creates', () => {
    const doc = must(animateTo(base(), 's', { opacity: 0 }, { start: 0, duration: 10, ease: Ease.Enter }, resolve));

    expect(findClip(doc, 's')!.clip.keyframes.opacity[0].ease).toBe(Ease.Enter);
  });

  it('refuses a prop the clip cannot animate', () => {
    expect(animateTo(base(), 's', { nonsense: 1 }, { start: 0, duration: 10 }, resolve).ok).toBe(false);
  });

  it('refuses a missing clip', () => {
    expect(animateTo(base(), 'nope', { opacity: 0 }, { start: 0, duration: 10 }, resolve).ok).toBe(false);
  });
});
