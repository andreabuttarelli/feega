import type { Present } from '../../../packages/share-protocol/src/frame';
import type { Source } from '../messages';

export const PEER_COLOURS = ['#e5484d', '#f76b15', '#d6a100', '#30a46c', '#0091ff', '#8e4ec6', '#d6409f', '#00a2c7'];

const PEER_SLOT_PREFIX = 'peer:';
const SOURCE_TEXT = /^(.+):(\d+):(\d+)$/;
const HASH_BASE = 31;

export function colourOf(userId: string): string {
  const hash = [...userId].reduce((sum, char) => (sum * HASH_BASE + char.charCodeAt(0)) >>> 0, 0);
  return PEER_COLOURS[hash % PEER_COLOURS.length];
}

export const peerSlot = (userId: string) => `${PEER_SLOT_PREFIX}${userId}`;

export const peerIdOf = (slot: string): string | null => (slot.startsWith(PEER_SLOT_PREFIX) ? slot.slice(PEER_SLOT_PREFIX.length) : null);

export function peerSourceOf(text: string | undefined): Source | null {
  const match = text?.match(SOURCE_TEXT);
  return match ? { file: match[1], line: Number(match[2]), col: Number(match[3]) } : null;
}

export const strangersOf = (peers: Present[], own: string): Present[] => peers.filter((peer) => peer.userId !== own);
