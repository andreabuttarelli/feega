import { describe, expect, it } from 'vitest';
import { scheduleEntry } from './audio-graph';
import type { AudioEntry } from './audio-plan';

type Call = [string, ...number[]];

function fakeContext() {
  const calls: Record<string, Call[]> = {};
  const param = (name: string) => ({
    setValueAtTime: (v: number, t: number) => (calls[name] ??= []).push(['set', v, t]),
    linearRampToValueAtTime: (v: number, t: number) => (calls[name] ??= []).push(['ramp', v, t])
  });
  const node = (name: string, extra: object = {}) => ({
    name,
    connect: (target: unknown, ..._rest: number[]) => target,
    ...extra
  });
  let gains = 0;
  const context = {
    createBufferSource: () =>
      node('source', {
        buffer: null,
        start: (...args: number[]) => (calls.start = [['start', ...args]]),
        stop: () => {}
      }),
    createGain: () => {
      const name = ['upmix', 'left', 'right'][gains++] ?? 'extra';
      return node(name, {
        gain: param(name),
        channelCount: 1,
        channelCountMode: '',
        channelInterpretation: ''
      });
    },
    createChannelSplitter: () => node('split'),
    createChannelMerger: () => node('merge')
  };
  return { context: context as unknown as BaseAudioContext, calls };
}

const entry: AudioEntry = {
  clipId: 'm',
  url: '/m.mp3',
  at: 2,
  offset: 0.5,
  duration: 4,
  left: [
    { time: 2, value: 0 },
    { time: 3, value: 1 },
    { time: 6, value: 1 }
  ],
  right: [
    { time: 2, value: 1 },
    { time: 6, value: 1 }
  ]
};

const buffer = {} as AudioBuffer;

describe('scheduleEntry', () => {
  it('from the start of the video, plays the clip at its time with its curves', () => {
    const { context, calls } = fakeContext();
    scheduleEntry(context, buffer, entry, { origin: 10, from: 0 }, {} as AudioNode);

    expect(calls.start).toEqual([['start', 12, 0.5, 4]]);
    expect(calls.left).toEqual([
      ['set', 0, 12],
      ['ramp', 1, 13],
      ['ramp', 1, 16]
    ]);
  });

  it('from the middle of a clip, starts at once, deeper into the file, mid-curve', () => {
    const { context, calls } = fakeContext();
    scheduleEntry(context, buffer, entry, { origin: 10, from: 2.5 }, {} as AudioNode);

    expect(calls.start).toEqual([['start', 10, 1, 3.5]]);
    expect(calls.left).toEqual([
      ['set', 0.5, 10],
      ['ramp', 1, 10.5],
      ['ramp', 1, 13.5]
    ]);
  });

  it('a clip already over is not scheduled', () => {
    const { context, calls } = fakeContext();

    expect(scheduleEntry(context, buffer, entry, { origin: 0, from: 7 }, {} as AudioNode)).toBeNull();
    expect(calls.start).toBeUndefined();
  });
});
