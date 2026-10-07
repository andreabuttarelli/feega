import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { addClip, setKeyframes, trimClip, ClipEdge, type OpResult } from './timeline';
import { audioPlan, gainAt } from './audio-plan';
import { Ease } from './design';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const base = newMotionDoc(MotionFormat.Vertical);

const ramp = (from: number, to: number) => [
  { frame: 0, value: from, ease: Ease.Linear },
  { frame: 30, value: to, ease: Ease.Linear }
];

const flat = (at: number, end: number, value: number) => [
  { time: at, value },
  { time: end, value }
];

describe('audio plan', () => {
  it('places an audio clip at its start, from its trim, for its length, at its volume', () => {
    const doc = must(addClip(base, { component: 'Audio', from: 30, durationInFrames: 90, props: { assetId: 'vo', volume: 0.8 } }, 'a'));
    const trimmed = must(trimClip(doc, 'a', ClipEdge.Start, 45));

    expect(audioPlan(trimmed, { vo: '/vo.mp3' })).toEqual([{ clipId: 'a', url: '/vo.mp3', at: 1.5, offset: 0.5, duration: 2.5, left: flat(1.5, 4, 0.8), right: flat(1.5, 4, 0.8) }]);
  });

  it('a video clip is heard only when its volume is above zero', () => {
    const muted = must(addClip(base, { component: 'Video', from: 0, props: { assetId: 'v' } }, 'v1'));
    const loud = must(addClip(base, { component: 'Video', from: 0, props: { assetId: 'v', volume: 0.5 } }, 'v1'));

    expect(audioPlan(muted, { v: '/v.mp4' })).toEqual([]);
    expect(audioPlan(loud, { v: '/v.mp4' })[0].left[0].value).toBe(0.5);
  });

  it('a muted clip with a volume keyframe above zero is heard', () => {
    const clip = must(addClip(base, { component: 'Video', from: 0, durationInFrames: 30, props: { assetId: 'v' } }, 'v1'));
    const doc = must(setKeyframes(clip, 'v1', 'volume', ramp(0, 1)));

    expect(audioPlan(doc, { v: '/v.mp4' })[0].left).toEqual([
      { time: 0, value: 0 },
      { time: 1, value: 1 }
    ]);
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

  it('fades ramp up, hold, ramp down, never longer than half the clip', () => {
    const doc = must(addClip(base, { component: 'Audio', from: 60, durationInFrames: 60, props: { assetId: 'm', volume: 0.5, fadeIn: 0.5, fadeOut: 3 } }, 'a'));

    expect(audioPlan(doc, { m: '/m.mp3' })[0].left).toEqual([
      { time: 2, value: 0 },
      { time: 2.5, value: 0.5 },
      { time: 3, value: 0.5 },
      { time: 4, value: 0 }
    ]);
  });

  it('volume keyframes follow their ease and multiply with the fades', () => {
    const clip = must(addClip(base, { component: 'Audio', from: 0, durationInFrames: 60, props: { assetId: 'm', fadeOut: 1 } }, 'a'));
    const doc = must(setKeyframes(clip, 'a', 'volume', ramp(1, 0.2)));

    expect(audioPlan(doc, { m: '/m.mp3' })[0].left).toEqual([
      { time: 0, value: 1 },
      { time: 1, value: 0.2 },
      { time: 2, value: 0 }
    ]);
  });

  it('pan moves the sound between left and right, keeping the near side at full level', () => {
    const hard = must(addClip(base, { component: 'Audio', from: 0, durationInFrames: 30, props: { assetId: 'm', volume: 0.8, pan: -1 } }, 'a'));
    const half = must(addClip(base, { component: 'Audio', from: 0, durationInFrames: 30, props: { assetId: 'm', volume: 1, pan: 0.5 } }, 'a'));

    const [left] = audioPlan(hard, { m: '/m.mp3' });
    const [right] = audioPlan(half, { m: '/m.mp3' });

    expect([left.left[0].value, left.right[0].value]).toEqual([0.8, 0]);
    expect([right.left[0].value, right.right[0].value]).toEqual([0.5, 1]);
  });

  it('a pan keyframe sweeps the sound across', () => {
    const clip = must(addClip(base, { component: 'Audio', from: 0, durationInFrames: 30, props: { assetId: 'm' } }, 'a'));
    const doc = must(setKeyframes(clip, 'a', 'pan', ramp(-1, 1)));
    const [e] = audioPlan(doc, { m: '/m.mp3' });

    expect(e.left.map((p) => p.value)).toEqual([1, 1, 0]);
    expect(e.right.map((p) => p.value)).toEqual([0, 1, 1]);
  });

  it('samples a gain curve between its points', () => {
    const points = [
      { time: 1, value: 0 },
      { time: 2, value: 1 }
    ];
    expect([gainAt(points, 0), gainAt(points, 1.5), gainAt(points, 3)]).toEqual([0, 0.5, 1]);
  });
});
