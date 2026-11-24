import { describe, expect, it } from 'vitest';
import { HOST_PEER } from '../../../packages/share-protocol/src/frame';
import { PEER_COLOURS, colourOf, peerIdOf, peerSlot, peerSourceOf, strangersOf } from './peers';

describe('peers', () => {
  it('gives the same person the same colour every time', () => {
    expect(colourOf('ada')).toBe(colourOf('ada'));
    expect(PEER_COLOURS).toContain(colourOf('ada'));
  });

  it('spreads people over the palette', () => {
    const people = Array.from({ length: 24 }, (_, i) => `user-${i}`);

    expect(new Set(people.map(colourOf)).size).toBeGreaterThan(3);
  });

  it('turns a user id into a tracking slot and back', () => {
    expect(peerIdOf(peerSlot('ada'))).toBe('ada');
    expect(peerIdOf('selected')).toBeNull();
  });

  it('reads a source back from the text a peer sent', () => {
    expect(peerSourceOf('src/App.tsx:12:3')).toEqual({ file: 'src/App.tsx', line: 12, col: 3 });
    expect(peerSourceOf(undefined)).toBeNull();
    expect(peerSourceOf('nonsense')).toBeNull();
  });

  it('leaves out the host from what the host sees, and keeps the guests', () => {
    const peers = [{ userId: HOST_PEER, name: 'Host', role: 'editor' as const }, { userId: 'ada', name: 'Ada', role: 'editor' as const }];

    expect(strangersOf(peers, HOST_PEER).map((p) => p.userId)).toEqual(['ada']);
  });
});
