import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { addClip, trimClip, ClipEdge, type OpResult } from './timeline';
import { audioPlan, gainCurve } from './audio-plan';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const base = newMotionDoc(MotionFormat.Vertical);

describe('audio plan', () => {
  it('places an audio clip at its start, from its trim, for its length, at its volume', () => {
    const doc = must(addClip(base, { component: 'Audio', from: 30, durationInFrames: 90, props: { assetId: 'vo', volume: 0.8 } }, 'a'));
    const trimmed = must(trimClip(doc, 'a', ClipEdge.Start, 45));

    expect(audioPlan(trimmed, { vo: '/vo.mp3' })).toEqual([{ clipId: 'a', url: '/vo.mp3', at: 1.5, offset: 0.5, duration: 2.5, volume: 0.8, fadeIn: 0, fadeOut: 0 }]);
  });

  it('a video clip is heard only when its volume is above zero', () => {
    const muted = must(addClip(base, { component: 'Video', from: 0, props: { assetId: 'v' } }, 'v1'));
    const loud = must(addClip(base, { component: 'Video', from: 0, props: { assetId: 'v', volume: 0.5 } }, 'v1'));

    expect(audioPlan(muted, { v: '/v.mp4' })).toEqual([]);
    expect(audioPlan(loud, { v: '/v.mp4' }).map((e) => e.volume)).toEqual([0.5]);
  });

  it('skips clips without a playable file and clips past the end of the video', () => {
    const empty = must(addClip(base, { component: 'Audio', from: 0 }, 'a'));
    const late = must(addClip(base, { component: 'Audio', from: base.durationInFrames + 30, props: { assetId: 'm' } }, 'b'));

    expect(audioPlan(empty, {})).toEqual([]);
    expect(audioPlan({ ...late, durationInFrames: base.durationInFrames }, { m: '/m.mp3' })).toEqual([]);
  });

  it('cuts a clip at the end of the video', () => {
    const doc = must(addClip(base, { component: 'Audio', from: base.durationInFrames - 30, durationInFrames: 150, props: { assetId: 'm' } }, 'a'));

    expect(audioPlan({ ...doc, durationInFrames: base.durationInFrames }, { m: '/m.mp3' })[0].duration).toBe(1);
  });

  it('carries fades, never longer than half the clip', () => {
    const doc = must(addClip(base, { component: 'Audio', from: 0, durationInFrames: 60, props: { assetId: 'm', fadeIn: 0.5, fadeOut: 3 } }, 'a'));

    expect(audioPlan(doc, { m: '/m.mp3' })[0]).toMatchObject({ fadeIn: 0.5, fadeOut: 1 });
  });

  it('a gain curve ramps up, holds, ramps down', () => {
    expect(gainCurve({ at: 2, duration: 10, volume: 0.5, fadeIn: 1, fadeOut: 2 })).toEqual([
      { time: 2, value: 0 },
      { time: 3, value: 0.5 },
      { time: 10, value: 0.5 },
      { time: 12, value: 0 }
    ]);
    expect(gainCurve({ at: 0, duration: 4, volume: 1, fadeIn: 0, fadeOut: 0 })).toEqual([
      { time: 0, value: 1 },
      { time: 4, value: 1 }
    ]);
  });
});
