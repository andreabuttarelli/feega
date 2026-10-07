import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, type OpResult } from '../timeline';
import { expressionValue } from '../expression/bake';
import { SPRINGS } from '../spring';
import { Lens, addLens } from './ops';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const titled = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 180 }, 'title'));
const ids = { clip: 'drop', track: 'glass' };

describe('adding a liquid glass drop', () => {
  it('goes on a new top track, so everything already in the video is under the lens', () => {
    const doc = must(addLens(titled, Lens.Glass, { from: 0, durationInFrames: 120, props: {}, path: [], spring: SPRINGS.soft, fadeIn: 0, fadeOut: 0 }, ids));

    expect(doc.tracks[0].id).toBe('glass');
    expect(findClip(doc, 'drop')!.clip.component).toBe('LiquidGlass');
  });

  it('glides on a spring: holds each stop until its time, settles on the last', () => {
    const path = [
      { time: 0, x: 0.1, y: 0.5 },
      { time: 1, x: 0.45, y: 0.48 },
      { time: 3, x: 0.5, y: 0.8 }
    ];
    const doc = must(addLens(titled, Lens.Glass, { from: 30, durationInFrames: 150, props: {}, path, spring: SPRINGS.soft, fadeIn: 0, fadeOut: 0 }, ids));
    const x = (frame: number) => expressionValue(doc, 'drop', 'centerX', frame);

    expect(findClip(doc, 'drop')!.clip.props.centerX).toBe(0.1);
    expect(x(30)).toBeCloseTo(0.1, 3);
    expect(x(30 + 20)).toBeCloseTo(0.1, 3);
    expect(x(30 + 45)).toBeGreaterThan(0.3);
    expect(expressionValue(doc, 'drop', 'centerY', 30 + 149)).toBeCloseTo(0.8, 2);
  });

  it('fades its presence in and out over the asked seconds', () => {
    const doc = must(addLens(titled, Lens.Glass, { from: 0, durationInFrames: 120, props: {}, path: [], spring: SPRINGS.soft, fadeIn: 15, fadeOut: 20 }, ids));

    expect(findClip(doc, 'drop')!.clip.keyframes.presence?.map((k) => [k.frame, k.value])).toEqual([
      [0, 0],
      [15, 1],
      [100, 1],
      [120, 0]
    ]);
  });
});
