import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { frameOfLive } from '$lib/canvas/core/frame-source';
import { Wrap, advance, withPlayhead } from './frame-playhead';

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
  const whole = { from: 0, to: 300 };
  const play = (head: number, ms: number, range = whole, wrap = Wrap.Loop) => advance({ head, ms, fps: 30, range, wrap });

  it('moves by the frames the elapsed time covers', () => {
    expect(play(0, 1000)).toBe(30);
  });

  it('plays at the doc rate on a 60 Hz screen, not one frame per paint', () => {
    let head: number | null = 0;
    for (let tick = 0; tick < 60; tick++) {
      head = play(head!, 1000 / 60);
    }
    expect(Math.floor(head!)).toBe(30);
  });

  it('keeps moving on a 120 Hz screen', () => {
    let head: number | null = 0;
    for (let tick = 0; tick < 120; tick++) {
      head = play(head!, 1000 / 120);
    }
    expect(Math.floor(head!)).toBe(30);
  });

  it('loops back to the start at the end of the doc without a held frame', () => {
    expect(play(295, 1000)).toBe(25);
  });

  it('loops inside the work area', () => {
    expect(play(95, 1000, { from: 60, to: 100 })).toBe(85);
  });

  it('stops at the out point when looping is off', () => {
    expect(play(295, 1000, whole, Wrap.Stop)).toBeNull();
  });
});
