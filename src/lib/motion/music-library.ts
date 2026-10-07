export enum Mood {
  Energetic = 'energetic',
  Uplifting = 'uplifting',
  Calm = 'calm'
}

export enum MusicSource {
  Generated = 'generated',
  Library = 'library'
}

export const CC0 = 'CC0-1.0';

export type LibraryTrack = { id: string; mood: Mood; bpm: number; seconds: number; license: typeof CC0; author: string; file: string };

const IN_HOUSE = 'feega, scripts/music/build-library.sh';

export const MUSIC_LIBRARY: readonly LibraryTrack[] = [
  { id: 'drive-128', mood: Mood.Energetic, bpm: 128, seconds: 32, license: CC0, author: IN_HOUSE, file: 'drive-128.mp3' },
  { id: 'lift-110', mood: Mood.Uplifting, bpm: 110, seconds: 32, license: CC0, author: IN_HOUSE, file: 'lift-110.mp3' },
  { id: 'glow-90', mood: Mood.Calm, bpm: 90, seconds: 32, license: CC0, author: IN_HOUSE, file: 'glow-90.mp3' }
];

const MOOD_BPM: Record<Mood, number> = { [Mood.Energetic]: 128, [Mood.Uplifting]: 110, [Mood.Calm]: 90 };

export function pickTrack(want: { mood: Mood; bpm?: number }): LibraryTrack {
  const bpm = want.bpm ?? MOOD_BPM[want.mood];
  const ofMood = MUSIC_LIBRARY.filter((t) => t.mood === want.mood);
  const pool = ofMood.length ? ofMood : MUSIC_LIBRARY;
  return [...pool].sort((a, b) => Math.abs(a.bpm - bpm) - Math.abs(b.bpm - bpm))[0];
}

const SOURCE_RULES: { source: MusicSource; applies: (setup: { generator: boolean }) => boolean }[] = [
  { source: MusicSource.Generated, applies: (setup) => setup.generator },
  { source: MusicSource.Library, applies: () => true }
];

export function musicSource(setup: { generator: boolean }): MusicSource {
  return SOURCE_RULES.find((rule) => rule.applies(setup))!.source;
}
