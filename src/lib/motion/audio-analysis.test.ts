import { describe, expect, it } from 'vitest';
import { ANALYSIS_VERSION, analyzeAudio, ampAt, beatAt, onsetAt } from './audio-analysis';

const RATE = 22_050;

function silence(seconds: number): Float32Array {
  return new Float32Array(Math.round(seconds * RATE));
}

function clicks(seconds: number, bpm: number, start = 0): Float32Array {
  const out = silence(seconds);
  const period = 60 / bpm;
  for (let t = start; t < seconds; t += period) {
    const at = Math.round(t * RATE);
    for (let i = 0; i < 400 && at + i < out.length; i++) {
      out[at + i] = Math.sin(i * 0.3) * Math.exp(-i / 80);
    }
  }
  return out;
}

function tone(out: Float32Array, from: number, to: number, level = 0.5): Float32Array {
  for (let i = Math.round(from * RATE); i < Math.round(to * RATE); i++) {
    out[i] = level * Math.sin((2 * Math.PI * 220 * i) / RATE) * (1 + 0.3 * Math.sin((2 * Math.PI * 4 * i) / RATE));
  }
  return out;
}

describe('analyzeAudio', () => {
  it('finds the tempo and a beat grid on a click track', () => {
    const a = analyzeAudio(clicks(8, 120, 0.25), RATE, 30);

    expect(a.version).toBe(ANALYSIS_VERSION);
    expect(a.bpm).toBe(120);
    expect(a.beats[0]).toBeCloseTo(0.25, 1);
    expect(a.beats[1] - a.beats[0]).toBeCloseTo(0.5, 2);
    expect(a.beats.length).toBeGreaterThanOrEqual(15);
  });

  it('finds each click as an onset', () => {
    const a = analyzeAudio(clicks(4, 100), RATE, 30);

    expect(a.onsets.length).toBe(7);
    expect(a.onsets[1]).toBeCloseTo(0.6, 1);
  });

  it('the amplitude envelope has one value per frame, loudest at 1', () => {
    const a = analyzeAudio(tone(silence(2), 1, 2), RATE, 30);

    expect(a.amp.length).toBe(60);
    expect(a.amp[10]).toBe(0);
    expect(Math.max(...a.amp)).toBe(1);
  });

  it('speech regions cover the voiced stretches, not the pauses', () => {
    const voice = tone(tone(silence(5), 0.5, 1.8), 3, 4.2);
    const a = analyzeAudio(voice, RATE, 30);

    expect(a.speech.length).toBe(2);
    expect(a.speech[0].start).toBeCloseTo(0.5, 1);
    expect(a.speech[0].end).toBeCloseTo(1.8, 1);
    expect(a.speech[1].start).toBeCloseTo(3, 1);
  });

  it('is deterministic', () => {
    const input = clicks(3, 128);
    expect(analyzeAudio(input, RATE, 30)).toEqual(analyzeAudio(input, RATE, 30));
  });

  it('silence has no tempo, beats or speech', () => {
    const a = analyzeAudio(silence(2), RATE, 30);
    expect([a.bpm, a.beats, a.onsets, a.speech]).toEqual([null, [], [], []]);
  });
});

describe('reading an analysis at a time', () => {
  const a = analyzeAudio(clicks(4, 120), RATE, 30);

  it('amp samples the envelope, smoothed over a number of frames', () => {
    expect(ampAt(a, 0.01)).toBeGreaterThan(0.3);
    expect(ampAt(a, 0.3)).toBe(0);
    expect(ampAt(a, 0.3, 30)).toBeGreaterThan(0);
  });

  it('beat and onset fall from 1 at the hit to 0 before the next', () => {
    expect(beatAt(a, a.beats[2])).toBe(1);
    expect(beatAt(a, a.beats[2] + 0.1)).toBeLessThan(1);
    expect(beatAt(a, a.beats[2] + 0.45)).toBe(0);
    expect(onsetAt(a, a.onsets[1])).toBe(1);
  });
});
