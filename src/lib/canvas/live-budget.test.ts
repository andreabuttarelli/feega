import { describe, expect, it } from 'vitest';
import { CameraMotion } from './core/camera-motion';
import { liveFrameModes, FrameMode } from './live-budget';

const frames = [
  { id: 'a', visible: true, area: 100 },
  { id: 'b', visible: true, area: 300 },
  { id: 'c', visible: false, area: 900 },
  { id: 'd', visible: true, area: 200 }
];

describe('liveFrameModes', () => {
  it('tiene live solo i più grandi visibili, fino al limite', () => {
    expect(liveFrameModes(frames, 2, CameraMotion.Still)).toEqual({ a: FrameMode.Snapshot, b: FrameMode.Live, c: FrameMode.Snapshot, d: FrameMode.Live });
  });

  it('durante il movimento di camera tutto è snapshot', () => {
    expect(new Set(Object.values(liveFrameModes(frames, 4, CameraMotion.Moving)))).toEqual(new Set([FrameMode.Snapshot]));
  });
});
