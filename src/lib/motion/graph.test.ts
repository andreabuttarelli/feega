import { describe, expect, it } from 'vitest';
import { Ease } from './design';
import { EASE_BEZIER, Interp, sampleTrack, type Keyframe } from './keyframes';
import { MotionFormat, newClip, newMotionDoc } from './doc';
import { graphLanes } from './timeline-view';
import { EasePreset, GraphMode, KeyEnd, curvePoints, dragHandle, easeHandles, fitView, handlePoints, presetEase, withHandles } from './graph';

const FPS = 30;
const a: Keyframe = { frame: 0, value: 0, ease: [0.4, 0.1, 0.7, 0.9] };
const b: Keyframe = { frame: 30, value: 300, ease: Ease.Linear };

describe('graph editor handle math', () => {
  it('reads influence and speed from a bezier ease', () => {
    const h = easeHandles(a, b, FPS);
    expect(h.outInfluence).toBeCloseTo(0.4, 9);
    expect(h.inInfluence).toBeCloseTo(0.3, 9);
    expect(h.outSpeed).toBeCloseTo((0.1 / 0.4) * 300, 6);
    expect(h.inSpeed).toBeCloseTo((0.1 / 0.3) * 300, 6);
  });

  it('writing the handles back gives the same ease', () => {
    const back = withHandles(easeHandles(a, b, FPS), a, b, FPS);
    back.forEach((n, i) => expect(n).toBeCloseTo((a.ease as number[])[i], 9));
  });

  it('the speed read off a handle is the speed the sampler moves at', () => {
    const h = easeHandles(a, b, FPS);
    const dt = 1e-4;
    expect(((sampleTrack([a, b], dt) - sampleTrack([a, b], 0)) / dt) * FPS).toBeCloseTo(h.outSpeed, 1);
  });

  it('a named ease has handles too', () => {
    const h = easeHandles({ ...a, ease: Ease.Standard }, b, FPS);
    expect(h.outInfluence).toBeCloseTo(EASE_BEZIER[Ease.Standard][0], 9);
  });

  it('dragging an out handle in the value graph moves the first control point', () => {
    const { out } = handlePoints(a, b);
    expect(out).toEqual({ frame: 12, value: 30 });
    const next = dragHandle(a, b, KeyEnd.Out, { frame: 15, value: 0 }, GraphMode.Value, FPS);
    expect(next).toEqual([0.5, 0, 0.7, 0.9]);
  });

  it('dragging an in handle in the speed graph sets influence by time and speed by height', () => {
    const next = dragHandle(a, b, KeyEnd.In, { frame: 30 - 9, value: 0 }, GraphMode.Speed, FPS);
    expect(next[2]).toBeCloseTo(0.7, 9);
    expect(next[3]).toBeCloseTo(1, 9);
  });

  it('handles stay inside what the doc accepts', () => {
    const next = dragHandle(a, b, KeyEnd.Out, { frame: -50, value: 99999 }, GraphMode.Value, FPS);
    expect(next[0]).toBe(0);
    expect(next[1]).toBe(3);
  });

  it('a flat segment keeps its speed at zero', () => {
    const flat = { ...b, value: 0 };
    expect(easeHandles(a, flat, FPS).outSpeed).toBe(0);
  });
});

describe('ease presets', () => {
  it('easy ease is a third of influence and zero speed on both sides', () => {
    expect(presetEase(EasePreset.EasyEase, a.ease)).toEqual([1 / 3, 0, 2 / 3, 1]);
  });

  it('easy ease in touches only the entering half, out only the leaving half', () => {
    expect(presetEase(EasePreset.EasyEaseIn, a.ease)).toEqual([0.4, 0.1, 2 / 3, 1]);
    expect(presetEase(EasePreset.EasyEaseOut, a.ease)).toEqual([1 / 3, 0, 0.7, 0.9]);
  });

  it('the Apple curves are the CSS/Core Animation timing functions', () => {
    expect(presetEase(EasePreset.AppleEaseInOut, a.ease)).toEqual([0.42, 0, 0.58, 1]);
    expect(presetEase(EasePreset.AppleDefault, a.ease)).toEqual([0.25, 0.1, 0.25, 1]);
  });
});

describe('graph curves and view', () => {
  const track = [a, b, { frame: 60, value: 100, ease: Ease.Linear, in: Interp.Linear }];

  it('the value graph is the sampled value', () => {
    const points = curvePoints(track, GraphMode.Value, FPS, 6);
    expect(points[0]).toEqual({ frame: 0, value: 0 });
    expect(points.at(-1)).toEqual({ frame: 60, value: 100 });
  });

  it('the speed graph is the rate of change per second', () => {
    const points = curvePoints(track, GraphMode.Speed, FPS, 60);
    expect(points.at(-2)!.value).toBeCloseTo((-200 / 30) * FPS, 0);
  });

  it('fit to view frames every point with a margin, and never a zero height', () => {
    expect(fitView([{ frame: 0, value: 0 }, { frame: 10, value: 100 }], 0.1)).toEqual({ frames: [-1, 11], values: [-10, 110] });
    expect(fitView([{ frame: 0, value: 5 }, { frame: 10, value: 5 }], 0.1).values).toEqual([4, 6]);
  });
});

describe('which curves the graph editor shows', () => {
  const doc = newMotionDoc(MotionFormat.Square);
  doc.tracks[0].clips.push(
    newClip({ id: 'c', from: 10, durationInFrames: 60, component: 'Title', props: {}, keyframes: { x: [a, b], color: [{ frame: 0, value: '#000000', ease: Ease.Linear }, { frame: 5, value: '#ffffff', ease: Ease.Linear }], opacity: [a, b] } }),
    newClip({ id: 'd', from: 0, durationInFrames: 60, component: 'Title', props: {}, keyframes: { y: [a, b] } })
  );

  it('the keyframes picked decide the curves, on their own lanes', () => {
    expect(graphLanes(doc, [], [{ clipId: 'c', prop: 'opacity', frame: 0 }], false).map((l) => l.prop)).toEqual(['opacity']);
  });

  it('with no keyframe picked, every numeric lane of the selected clips, offset by the clip start', () => {
    const lanes = graphLanes(doc, ['c'], [], false);
    expect(lanes.map((l) => l.prop)).toEqual(['x', 'opacity']);
    expect(lanes[0].from).toBe(10);
  });
});
