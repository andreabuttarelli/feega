import { describe, expect, it } from 'vitest';
import { TrackType } from '@feega/motion-core/motion/layout/auto-layout';
import { formatTracks, parseTracks } from './tracks-text';

describe('track text', () => {
  it('reads px as fixed, fr as flex, hug as hug and auto as 1fr', () => {
    expect(parseTracks('120 2fr hug auto')).toEqual([
      { type: TrackType.Fixed, value: 120 },
      { type: TrackType.Flex, value: 2 },
      { type: TrackType.Hug, value: 0 },
      { type: TrackType.Flex, value: 1 }
    ]);
  });

  it('refuses a word it does not know', () => {
    expect(parseTracks('1fr wide')).toBeNull();
  });

  it('writes back what it reads', () => {
    expect(formatTracks(parseTracks('120px 1.5fr hug')!)).toBe('120 1.5fr hug');
  });
});
