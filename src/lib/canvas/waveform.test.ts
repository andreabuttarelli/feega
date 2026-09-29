import { describe, expect, it } from 'vitest';
import { peaksOf } from './waveform';

describe('waveform peaks', () => {
  it('keeps the loudest sample of each bucket, normalised to the loudest overall', () => {
    const samples = new Float32Array([0.1, -0.5, 0.2, 0.25, 0, -0.1]);
    expect(peaksOf(samples, 3)).toEqual([1, 0.5, 0.2]);
  });

  it('returns flat bars for silence instead of dividing by zero', () => {
    expect(peaksOf(new Float32Array(8), 4)).toEqual([0, 0, 0, 0]);
  });

  it('never asks for more bars than samples', () => {
    expect(peaksOf(new Float32Array([0.5, 1]), 10)).toHaveLength(2);
  });
});
