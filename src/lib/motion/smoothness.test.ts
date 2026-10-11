import { describe, expect, it } from 'vitest';
import { Jolt, docCuts, frameDiffs, joltMeter, joltNote, lumaOf, motionJolts } from './smoothness';

const ramp = (n: number, peak: number) => Array.from({ length: n }, (_, i) => peak * Math.sin((Math.PI * i) / (n - 1)));

describe('motionJolts', () => {
  it('an eased move, accelerating then settling, is smooth', () => {
    expect(motionJolts([0, 0, ...ramp(15, 3), 0, 0])).toEqual([]);
  });

  it('a lone spike in an otherwise steady move is a pop', () => {
    const steady = Array(12).fill(0.5);
    steady[6] = 4;

    expect(motionJolts(steady)).toEqual([{ frame: 6, kind: Jolt.Pop, value: 4, around: 0.5 }]);
  });

  it('a move that stops dead at speed is a stop, not an ease out', () => {
    expect(motionJolts([0, 0.5, 2, 5, 9, 9.5, 0.2, 0.2, 0.2]).map((j) => [j.frame, j.kind])).toEqual([[6, Jolt.Stop]]);
  });

  it('frames that alternate between two states every frame are a flicker', () => {
    expect(motionJolts([1.5, 0, 1.5, 0, 1.5, 0, 1.5, 0]).map((j) => j.kind)).toContain(Jolt.Flicker);
  });

  it('a hard cut the edit asked for is not a jolt', () => {
    expect(motionJolts([0.2, 0.2, 0.2, 60, 0.2, 0.2, 0.2], { cuts: [3] })).toEqual([]);
  });

  it('a hold, nothing moving, is smooth', () => {
    expect(motionJolts(Array(20).fill(0))).toEqual([]);
  });
});

describe('frameDiffs', () => {
  it('is the mean absolute change between consecutive frames', () => {
    const frames = [new Uint8Array([0, 0]), new Uint8Array([10, 30]), new Uint8Array([10, 30])];

    expect(frameDiffs(frames)).toEqual([20, 0]);
  });
});

describe('the export measures its own frames', () => {
  const grey = (v: number, n = 4) => new Uint8Array(n).fill(v);

  it('a meter fed frame by frame finds the pop the whole-video check finds, holding one frame at a time', () => {
    const frames = [0, 1, 2, 3, 4, 5, 40, 7, 8, 9, 10, 11].map((v) => grey(v));
    const meter = joltMeter();
    frames.forEach((f) => meter.add(f));

    expect(meter.jolts({})).toEqual(motionJolts(frameDiffs(frames)));
    expect(meter.jolts({}).map((j) => j.kind)).toContain(Jolt.Pop);
  });

  it('reads luma from RGBA pixels', () => {
    expect([...lumaOf(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]))]).toEqual([255, 0]);
  });

  it('a cut between two clips is asked for, a junction between them is not', () => {
    const clip = (from: number, durationInFrames: number, junction?: object) => ({ id: `c${from}`, from, durationInFrames, junction });
    const doc = { tracks: [{ clips: [clip(0, 30), clip(30, 30, { kind: 'morph' }), clip(60, 30)] }] };

    expect(docCuts(doc as never)).toEqual([-1, 0, 59, 60, 89, 90]);
  });
});

describe('what the export tells the user', () => {
  it('names each jump by its second, so it can be found and fixed', () => {
    expect(joltNote([{ frame: 95, kind: Jolt.Pop, value: 9, around: 1 }, { frame: 212, kind: Jolt.Stop, value: 0.1, around: 6 }], 30)).toBe('2 frame jumps, at 3.2 s (pop) and 7.1 s (stop): ask the agent to smooth them.');
  });

  it('says so when the motion is smooth', () => {
    expect(joltNote([], 30)).toBe('Smooth: no frame jumps.');
  });
});
