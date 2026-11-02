import { describe, expect, it } from 'vitest';
import { GLIDE_MS, peerTracks } from './peer-tracks';
import type { CanvasPeer } from './canvas-presence';

const peer = (over: Partial<CanvasPeer> = {}): CanvasPeer => ({
  sessionId: 's', userId: 'u', name: 'u', cursor: null, selection: [], live: [], view: null, presenting: false, chat: null, at: 0, colour: '#000', ...over
});

describe('peerTracks: peers drawn on smooth paths', () => {
  it('a cursor between two marks is drawn between them', () => {
    const tracks = peerTracks();
    tracks.heard(peer({ cursor: { x: 0, y: 0 } }), 0, 1000);
    tracks.heard(peer({ cursor: { x: 100, y: 0 } }), 50, 1050);

    const [drawn] = tracks.smooth([peer({ cursor: { x: 100, y: 0 } })], 1120);
    expect(drawn.cursor!.x).toBeGreaterThan(0);
    expect(drawn.cursor!.x).toBeLessThan(100);
  });

  it('a dragged box moves smoothly too, keeping its size', () => {
    const tracks = peerTracks();
    tracks.heard(peer({ live: [{ id: 'n', x: 0, y: 0, w: 10 }] }), 0, 1000);
    tracks.heard(peer({ live: [{ id: 'n', x: 100, y: 0, w: 10 }] }), 50, 1050);

    const [drawn] = tracks.smooth([peer({ live: [{ id: 'n', x: 100, y: 0, w: 10 }] })], 1120);
    expect(drawn.live[0].x).toBeGreaterThan(0);
    expect(drawn.live[0].x).toBeLessThan(100);
    expect(drawn.live[0].w).toBe(10);
  });

  it('an agent cursor glides to its new spot instead of jumping', () => {
    const tracks = peerTracks();
    const agent = { agent: { doing: 'set text' } };
    tracks.heard(peer({ ...agent, cursor: { x: 0, y: 0 } }), 0, 1000);
    tracks.heard(peer({ ...agent, cursor: { x: 1000, y: 0 } }), 3000, 4000);

    const [mid] = tracks.smooth([peer({ ...agent, cursor: { x: 1000, y: 0 } })], 4000 + GLIDE_MS / 2);
    expect(mid.cursor!.x).toBeGreaterThan(0);
    expect(mid.cursor!.x).toBeLessThan(1000);

    const [end] = tracks.smooth([peer({ ...agent, cursor: { x: 1000, y: 0 } })], 4000 + GLIDE_MS);
    expect(end.cursor!.x).toBe(1000);
  });

  it('says when nothing has moved lately, so the frame loop can stop', () => {
    const tracks = peerTracks();
    tracks.heard(peer({ cursor: { x: 0, y: 0 } }), 0, 1000);
    expect(tracks.moving(1100)).toBe(true);
    expect(tracks.moving(5000)).toBe(false);
  });
});
