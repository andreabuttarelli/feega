import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { setExpression } from '@feega/motion-core/motion/expression/ops';
import { sampleTrack } from '@feega/motion-core/motion/keyframes';
import { prepare } from '@feega/motion-core/motion/gpu-full/display-list';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const pulse = { version: 1, fps: 30, duration: 2, amp: Array.from({ length: 60 }, (_, i) => (i < 30 ? 0 : 1)), onsets: [], bpm: null, beats: [], speech: [] };

function reactive(): MotionDoc {
  const shape = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 60 }, 'a'));
  const music = must(addClip(shape, { component: 'Audio', from: 0, durationInFrames: 60, props: { assetId: 'm' } }, 'music'));
  return must(setExpression(music, 'a', 'scale', 'value * (1 + audio.amp())'));
}

describe('preparing a video for the core', () => {
  it('bakes music-reactive motion from the stored analysis, as the HTML export does', () => {
    const prepared = prepare(reactive(), FEEGA_TOKENS, {}, undefined, { m: pulse });
    const track = findClip(prepared.doc, 'a')!.clip.keyframes.scale;

    expect([sampleTrack(track, 10), sampleTrack(track, 40)]).toEqual([1, 2]);
  });
});
