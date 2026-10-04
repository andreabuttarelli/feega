import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, addTrack, type OpResult } from '../timeline';
import { TrackKind } from '../components';
import { ANALYSIS_VERSION, type AudioAnalysis } from '../audio-analysis';
import { audioPort } from './audio-port';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const analysis = (amp: number[], beats: number[] = []): AudioAnalysis => ({ version: ANALYSIS_VERSION, fps: 30, duration: amp.length / 30, amp, onsets: beats, bpm: beats.length ? 120 : null, beats, speech: [] });

const analyses = {
  m: analysis(
    Array.from({ length: 300 }, (_, i) => (i % 2 ? 1 : 0)),
    [0, 0.5, 1, 1.5]
  ),
  v: analysis(Array.from({ length: 300 }, () => 0.3))
};

function scene(): MotionDoc {
  const base = { ...newMotionDoc(MotionFormat.Vertical), durationInFrames: 300 };
  const music = must(addClip(base, { component: 'Audio', from: 30, durationInFrames: 200, props: { assetId: 'm' } }, 'music'));
  const vo = must(addTrack(music, TrackKind.Audio, 'vo-track'));
  return must(addClip(vo, { component: 'Audio', from: 0, durationInFrames: 60, trackId: 'vo-track', props: { assetId: 'v' } }, 'vo'));
}

describe('audioPort', () => {
  it('amp reads the clip through its start: silent before it plays', () => {
    const doc = scene();

    expect(audioPort(doc, analyses, 10).amp('music', 1)).toBe(0);
    expect(audioPort(doc, analyses, 31).amp('music', 1)).toBe(1);
    expect(audioPort(doc, analyses, 32).amp('music', 2)).toBe(0.5);
  });

  it('a track id reads its clips; no reference reads the loudest audio playing', () => {
    const doc = scene();

    expect(audioPort(doc, analyses, 10).amp('vo-track', 1)).toBe(0.3);
    expect(audioPort(doc, analyses, 10).amp(null, 1)).toBe(0.3);
    expect(audioPort(doc, analyses, 31).amp(null, 1)).toBe(1);
  });

  it('beat is 1 on a beat of the music, then falls', () => {
    const doc = scene();

    expect(audioPort(doc, analyses, 45).beat(null)).toBe(1);
    expect(audioPort(doc, analyses, 50).beat(null)).toBeLessThan(1);
  });

  it('with no reference, beat follows the music bed, not the voice-over', () => {
    const doc = scene();
    const voBeats = { ...analyses, v: { ...analyses.v, bpm: 150, beats: [0.3] } };

    expect(audioPort(doc, voBeats, 9).beat(null)).toBe(0);
  });

  it('an unknown reference is an error the expression shows', () => {
    expect(() => audioPort(scene(), analyses, 0).amp('nope', 1)).toThrow(/no audio "nope"/);
  });
});
