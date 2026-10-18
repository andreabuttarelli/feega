import type { CanvasPeer, LiveBox } from './canvas-presence';
import { playout, type Values } from './playout';

const MOVING_MS = 1000;

type Track = ReturnType<typeof playout>;

type Tracks = { cursor: Track; boxes: Map<string, Track> };

const boxValues = ({ id: _id, ...rest }: LiveBox): Values =>
  Object.fromEntries(Object.entries(rest).filter((entry): entry is [string, number] => typeof entry[1] === 'number'));

export function peerTracks() {
  const sessions = new Map<string, Tracks>();
  let lastHeard = -Infinity;

  const tracksOf = (sessionId: string): Tracks => {
    const known = sessions.get(sessionId) ?? { cursor: playout(), boxes: new Map() };
    sessions.set(sessionId, known);
    return known;
  };

  function smoothBox(tracks: Tracks | undefined, box: LiveBox, now: number): LiveBox {
    const drawn = tracks?.boxes.get(box.id)?.sample(now);
    return drawn ? { ...box, ...drawn } : box;
  }

  return {
    heard(peer: Pick<CanvasPeer, 'sessionId' | 'cursor' | 'live'>, sentAt: number, receivedAt: number) {
      lastHeard = receivedAt;
      const tracks = tracksOf(peer.sessionId);
      if (peer.cursor) {
        tracks.cursor.push(sentAt, receivedAt, peer.cursor);
      }
      for (const box of peer.live) {
        const track = tracks.boxes.get(box.id) ?? playout();
        tracks.boxes.set(box.id, track);
        track.push(sentAt, receivedAt, boxValues(box));
      }
    },
    smooth(peers: CanvasPeer[], now: number): CanvasPeer[] {
      return peers.map((peer) => {
        const tracks = sessions.get(peer.sessionId);
        const cursor = peer.cursor ? (tracks?.cursor.sample(now) as { x: number; y: number } | null) ?? peer.cursor : null;
        return { ...peer, cursor, live: peer.live.map((box) => smoothBox(tracks, box, now)) };
      });
    },
    moving: (now: number) => now - lastHeard < MOVING_MS
  };
}
