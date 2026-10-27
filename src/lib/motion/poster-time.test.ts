import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { precompose } from '@feega/motion-core/motion/precomp';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { coverFrame } from '@feega/motion-core/motion/still';
import { restFrameOf } from './poster-time';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const blank = newMotionDoc(MotionFormat.Landscape);
const shape = must(addClip(blank, { component: 'Shape', from: 0, durationInFrames: blank.durationInFrames, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.1, height: 0.1, fill: '#ff0000' } }, 'tpl'));
const custom: MotionDoc = { ...shape, tracks: shape.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, component: 'Custom' })) })) };

describe('the frame a doc rests on', () => {
  it('a template whose content only the DOM knows rests on its cover frame, not on its empty opening', () => {
    const template = must(precompose(custom, ['tpl'], { comp: 'c', clip: 'pc' }, 'Template'));
    expect(restFrameOf(template)).toBe(coverFrame(template));
  });
});

describe('the frame a text doc rests on', () => {
  it('a text that fades in rests after the fade, not on its invisible opening', () => {
    const text = must(addClip(blank, { component: 'Text', from: 0, durationInFrames: blank.durationInFrames, props: { text: 'VIDEO', color: '#ff0000', size: 0.1, x: 0.5, y: 0.2, width: 0.4, height: 0.15 } }, 'title'));
    expect(restFrameOf(text)).toBeGreaterThan(0);
  });
});
