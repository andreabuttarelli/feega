import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from './doc';
import { addClip, type OpResult } from './timeline';
import { PulseProp, pulseWithMusic } from './pulse';
import { expressionValue } from './expression/bake';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const loud = { version: 1, fps: 30, duration: 2, amp: Array.from({ length: 60 }, () => 1), onsets: [], bpm: 120, beats: [0, 0.5, 1, 1.5], speech: [] };

function scene(): MotionDoc {
  const music = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Audio', from: 0, durationInFrames: 60, props: { assetId: 'm' } }, 'music'));
  return must(addClip(music, { component: 'Shape', from: 0, durationInFrames: 60 }, 'dot'));
}

describe('pulseWithMusic', () => {
  it('scale grows with the loudness of the music', () => {
    const doc = must(pulseWithMusic(scene(), 'dot', PulseProp.Scale));

    expect(expressionValue(doc, 'dot', 'scale', 10)).toBe(1);
    expect(expressionValue(doc, 'dot', 'scale', 10, { m: loud })).toBeCloseTo(1.3, 5);
  });

  it('opacity dims in the quiet and is full at the loudest', () => {
    const doc = must(pulseWithMusic(scene(), 'dot', PulseProp.Opacity));

    expect(expressionValue(doc, 'dot', 'opacity', 10)).toBeCloseTo(0.5, 5);
    expect(expressionValue(doc, 'dot', 'opacity', 10, { m: loud })).toBe(1);
  });

  it('blur flashes on each beat', () => {
    const doc = must(pulseWithMusic(scene(), 'dot', PulseProp.Blur));

    expect(expressionValue(doc, 'dot', 'blur', 15, { m: loud })).toBe(12);
    expect(expressionValue(doc, 'dot', 'blur', 23, { m: loud })).toBe(0);
  });

  it('needs music to follow', () => {
    const silent = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Shape', from: 0 }, 'dot'));
    expect(pulseWithMusic(silent, 'dot', PulseProp.Scale).ok).toBe(false);
  });

  it('strength scales the pulse and follows a named audio clip', () => {
    const doc = must(pulseWithMusic(scene(), 'dot', PulseProp.Scale, { strength: 1, source: 'music' }));

    expect(findClip(doc, 'dot')!.clip.expressions.scale).toContain('"music"');
    expect(expressionValue(doc, 'dot', 'scale', 10, { m: loud })).toBe(2);
  });
});
