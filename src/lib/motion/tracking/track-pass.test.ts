import { describe, expect, it } from 'vitest';
import { Pass, passRange } from './track-pass';

describe('which frames a track pass covers', () => {
  it('forward runs from the point to the end of the clip', () => {
    expect(passRange(Pass.Forward, 12, 99)).toEqual({ from: 12, to: 99 });
  });

  it('backward runs from the start of the clip to the point', () => {
    expect(passRange(Pass.Backward, 12, 99)).toEqual({ from: 0, to: 12 });
  });

  it('both ways cover the whole clip', () => {
    expect(passRange(Pass.Both, 12, 99)).toEqual({ from: 0, to: 99 });
  });
});
