import type { CanvasPeer } from '$lib/realtime/canvas-presence';

export type PeerRect = { x: number; y: number; w: number; h: number };
export type PeerOutline = { key: string; rect: PeerRect; colour: string; live: boolean };

function boxesOf(peer: CanvasPeer, rectOf: (id: string) => PeerRect | null): PeerOutline[] {
  const moving = new Map(peer.live.map((box) => [box.id, box]));
  return [...new Set([...peer.selection, ...moving.keys()])].flatMap((id) => {
    const rect = rectOf(id);
    const box = moving.get(id);
    if (!rect && !(box?.w && box.h)) {
      return [];
    }
    const at = { x: box?.x ?? rect!.x, y: box?.y ?? rect!.y, w: box?.w ?? rect!.w, h: box?.h ?? rect!.h };
    return [{ key: `${peer.sessionId}:${id}`, rect: at, colour: peer.colour, live: !!box }];
  });
}

export const peerOutlines = (peers: readonly CanvasPeer[], rectOf: (id: string) => PeerRect | null): PeerOutline[] => peers.flatMap((p) => boxesOf(p, rectOf));
