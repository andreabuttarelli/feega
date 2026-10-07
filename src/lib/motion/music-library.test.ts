import { describe, expect, it } from 'vitest';
import { MUSIC_LIBRARY, Mood, MusicSource, musicSource, pickTrack } from './music-library';

describe('music library', () => {
  it('every track carries a recorded CC0 licence', () => {
    expect(MUSIC_LIBRARY.length).toBeGreaterThan(0);
    for (const track of MUSIC_LIBRARY) {
      expect(track.license).toBe('CC0-1.0');
      expect(track.bpm).toBeGreaterThan(0);
    }
  });

  it('picks the track of the mood nearest the tempo asked', () => {
    expect(pickTrack({ mood: Mood.Energetic, bpm: 124 }).bpm).toBe(128);
    expect(pickTrack({ mood: Mood.Calm }).mood).toBe(Mood.Calm);
  });

  it('a generator when configured, the library otherwise', () => {
    expect(musicSource({ generator: true })).toBe(MusicSource.Generated);
    expect(musicSource({ generator: false })).toBe(MusicSource.Library);
  });
});
