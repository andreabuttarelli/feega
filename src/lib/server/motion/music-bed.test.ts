import { describe, expect, it } from 'vitest';
import { MUSIC_BED_LICENSE, SAMPLE_RATE, musicBed } from './music-bed';

const samplesOf = (wav: Buffer) => new Int16Array(wav.buffer.slice(wav.byteOffset + 44, wav.byteOffset + wav.length));

function energy(samples: Int16Array, from: number, ms: number): number {
  const start = Math.floor(from * SAMPLE_RATE);
  const end = start + Math.floor((ms / 1000) * SAMPLE_RATE);
  let sum = 0;
  for (let i = start; i < end; i++) {
    sum += Math.abs(samples[i]);
  }
  return sum / (end - start);
}

describe('the license-free music bed', () => {
  it('is a playable WAV of the asked length', () => {
    const wav = musicBed({ seconds: 15, bpm: 120 });

    expect(wav.subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(wav.subarray(8, 12).toString('latin1')).toBe('WAVE');
    expect(samplesOf(wav).length).toBe(15 * SAMPLE_RATE);
  });

  it('hits on the beat, so cuts can land on it', () => {
    const samples = samplesOf(musicBed({ seconds: 8, bpm: 120 }));

    expect(energy(samples, 2.0, 40)).toBeGreaterThan(energy(samples, 2.3, 40) * 1.5);
  });

  it('builds to a peak two thirds in', () => {
    const samples = samplesOf(musicBed({ seconds: 15, bpm: 120 }));

    expect(energy(samples, 10, 2000)).toBeGreaterThan(energy(samples, 1, 2000));
  });

  it('is the same file every time, and says it is CC0', () => {
    expect(musicBed({ seconds: 4, bpm: 100 }).equals(musicBed({ seconds: 4, bpm: 100 }))).toBe(true);
    expect(MUSIC_BED_LICENSE).toMatch(/CC0/);
  });
});
