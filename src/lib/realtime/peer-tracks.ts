import type { CanvasPeer, LiveBox } from './canvas-presence';
import { playout, type Values } from './playout';

const MOVING_MS = 1000;
export const GLIDE_MS = 700;

type Track = { push: (sentAt: number, receivedAt: number, value: Values) => void; sample: (now: number) => Values | null };

const easeInOut = (k: number) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);

const between = (from: Values, to: Values, k: number): Values =>
  Object.fromEntries(Object.keys(to).map((key) => [key, (from[key] ?? to[key]) + (to[key] - (from[key] ?? to[key])) * k]));

function glide(): Track {
  let from: Values | null = null;
  let to: Values | null = null;
  let start = 0;

  const sample = (now: number): Values | null => {
    if (!from || !to) {
      return null;
    }
    return between(from, to, easeInOut(Math.min(1, Math.max(0, (now - start) / GLIDE_MS))));
  };

  return {
    push(_sentAt, receivedAt, value) {
      from = sample(receivedAt) ?? value;
      to = value;
      start = receivedAt;
    },
    sample
  };
}

type Tracks = { cursor: Track; boxes: Map<string, Track> };

const boxValues = ({ id: _id, ...rest }: LiveBox): Values =>
  Object.fromEntries(Object.entries(rest).filter((entry): entry is [string, number] => typeof entry[1] === 'number'));

export function peerTracks() {
  const sessions = new Map<string, Tracks>();
  let lastHeard = -Infinity;

  const tracksOf = (sessionId: string, agent: boolean): Tracks => {
    const known = sessions.get(sessionId) ?? { cursor: agent ? glide() : playout(), boxes: new Map() };
    sessions.set(sessionId, known);
    return known;
  };

  function smoothBox(tracks: Tracks | undefined, box: LiveBox, now: number): LiveBox {
    const drawn = tracks?.boxes.get(box.id)?.sample(now);
    return drawn ? { ...box, ...drawn } : box;
  }

  return {
    heard(peer: Pick<CanvasPeer, 'sessionId' | 'cursor' | 'live' | 'agent'>, sentAt: number, receivedAt: number) {
      lastHeard = receivedAt;
      const tracks = tracksOf(peer.sessionId, !!peer.agent);
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
