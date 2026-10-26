import { TrackType, type TrackSize } from '@feega/motion-core/motion/layout/auto-layout';

const HUG_WORD = 'hug';
const AUTO_WORD = 'auto';

const READERS: { pattern: RegExp; track: (n: number) => TrackSize }[] = [
  { pattern: /^(\d+(?:\.\d+)?)fr$/, track: (n) => ({ type: TrackType.Flex, value: n }) },
  { pattern: /^(\d+(?:\.\d+)?)(?:px)?$/, track: (n) => ({ type: TrackType.Fixed, value: n }) }
];

const WORDS: Record<string, TrackSize> = {
  [HUG_WORD]: { type: TrackType.Hug, value: 0 },
  [AUTO_WORD]: { type: TrackType.Flex, value: 1 }
};

function readTrack(word: string): TrackSize | null {
  if (WORDS[word]) {
    return WORDS[word];
  }
  for (const { pattern, track } of READERS) {
    const hit = word.match(pattern);
    if (hit) {
      return track(Number(hit[1]));
    }
  }
  return null;
}

export function parseTracks(text: string): TrackSize[] | null {
  const tracks = text.trim().toLowerCase().split(/\s+/).filter(Boolean).map(readTrack);
  return tracks.every((t) => t !== null) ? (tracks as TrackSize[]) : null;
}

const WRITERS: Record<TrackType, (value: number) => string> = {
  [TrackType.Fixed]: (value) => `${value}`,
  [TrackType.Flex]: (value) => `${value}fr`,
  [TrackType.Hug]: () => HUG_WORD
};

export const formatTracks = (tracks: TrackSize[]) => tracks.map((t) => WRITERS[t.type](t.value)).join(' ');
