import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { frameOfLive } from '$lib/canvas/core/frame-source';
import { advance, withPlayhead } from './frame-playhead';

const doc = newMotionDoc(MotionFormat.Landscape);
const live = { doc, tokens: FEEGA_TOKENS, assets: {} };

describe('the playhead of a frame on the canvas', () => {
  it('draws the frame at the playhead instead of the poster', () => {
    expect(frameOfLive(withPlayhead(live, 12))).toBe(12);
  });

  it('without a playhead the frame stays on its poster', () => {
    expect(frameOfLive(live)).toBe(frameOfLive({ doc }));
    expect(withPlayhead(live, null).playhead).toBeUndefined();
  });

  it('never writes the playhead into the doc', () => {
    expect(withPlayhead(live, 5).doc).toBe(doc);
  });

  it('stays inside the doc', () => {
    expect(withPlayhead(live, 99999).playhead).toBe(doc.durationInFrames - 1);
    expect(withPlayhead(live, -4).playhead).toBe(0);
  });
});

describe('advancing playback', () => {
  it('moves by the frames the elapsed time covers', () => {
    expect(advance({ frame: 0, ms: 1000, fps: 30, duration: 300 })).toBe(30);
  });

  it('loops back to the start at the end of the doc', () => {
    expect(advance({ frame: 295, ms: 1000, fps: 30, duration: 300 })).toBe(25);
  });
});
