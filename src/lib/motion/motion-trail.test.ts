import { describe, expect, it } from 'vitest';
import type { MotionClip } from '@feega/motion-core/motion/doc';
import { Ease } from '@feega/motion-core/motion/design';
import { onionFrames, positionTrail } from './motion-trail';

const SIZE = { width: 100, height: 100 };
const key = (frame: number, value: number) => ({ frame, value, ease: Ease.Linear });
const clip = (keyframes: MotionClip['keyframes']): MotionClip => ({ id: 'c', from: 10, durationInFrames: 50, component: 'Shape', props: { shape: 'rect', x: 0.4, y: 0.4, width: 0.2, height: 0.2 }, transform: {}, keyframes }) as unknown as MotionClip;

describe('positionTrail', () => {
  it('follows the pivot through every frame between the first and last position key', () => {
    const trail = positionTrail(clip({ x: [key(0, 0), key(4, 0.4)] }), SIZE);

    expect(trail).toHaveLength(5);
    expect(trail[4][0] - trail[0][0]).toBeCloseTo(40);
  });

  it('spans x and y keys together', () => {
    expect(positionTrail(clip({ x: [key(0, 0), key(2, 0.1)], y: [key(6, 0.3)] }), SIZE)).toHaveLength(7);
  });

  it('draws nothing for a position that never moves', () => {
    expect(positionTrail(clip({ x: [key(3, 0.1)] }), SIZE)).toEqual([]);
    expect(positionTrail(clip({ opacity: [key(0, 0), key(9, 1)] }), SIZE)).toEqual([]);
  });
});

describe('onionFrames', () => {
  const keyed = clip({ x: [key(0, 0), key(20, 1)], opacity: [key(30, 1)] });

  it('picks the nearest key before and after the playhead, in video time', () => {
    expect(onionFrames(keyed, 35)).toEqual([30, 40]);
  });

  it('skips the key under the playhead', () => {
    expect(onionFrames(keyed, 40)).toEqual([30]);
    expect(onionFrames(keyed, 30)).toEqual([10, 40]);
  });

  it('has no ghost for an element without keys', () => {
    expect(onionFrames(clip({}), 20)).toEqual([]);
  });
});
