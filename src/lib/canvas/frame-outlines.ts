import type { FrameOutlines, LayerRow } from './layers';

export const HEADS_PARAM = 'heads';
export const MAX_HEADS = 200;

export type FrameHead = { nodeId: string; version: number };

const HEAD_SEP = ',';
const VERSION_SEP = ':';

export const headsParam = (heads: readonly FrameHead[]) => heads.map((h) => `${h.nodeId}${VERSION_SEP}${h.version}`).join(HEAD_SEP);

export function parseHeads(raw: string): FrameHead[] {
  return raw
    .split(HEAD_SEP)
    .slice(0, MAX_HEADS)
    .flatMap((pair) => {
      const [nodeId, version] = pair.split(VERSION_SEP);
      const n = Number(version);
      return nodeId && Number.isInteger(n) && n > 0 ? [{ nodeId, version: n }] : [];
    });
}

export const headKey = (head: FrameHead) => `${head.nodeId}${VERSION_SEP}${head.version}`;

export type OutlineCache = Readonly<Record<string, readonly LayerRow[]>>;

export const missingHeads = (heads: readonly FrameHead[], cache: OutlineCache) => heads.filter((h) => !(headKey(h) in cache));

export function cacheOutlines(cache: OutlineCache, asked: readonly FrameHead[], answer: FrameOutlines): OutlineCache {
  return { ...cache, ...Object.fromEntries(asked.map((h) => [headKey(h), answer[h.nodeId] ?? []])) };
}

export function outlinesFor(heads: readonly FrameHead[], cache: OutlineCache): FrameOutlines {
  return Object.fromEntries(heads.flatMap((h) => (headKey(h) in cache ? [[h.nodeId, cache[headKey(h)]]] : [])));
}

const FRAME_TYPE = 'motion';

export function frameHead(type: string, data: Record<string, unknown>): number | null {
  const version = Number(data.docHeadRevision);
  return type === FRAME_TYPE && Number.isInteger(version) && version > 0 ? version : null;
}

export const canvasHeads = (nodes: readonly { id: string; head?: number | null }[]): FrameHead[] => nodes.flatMap((n) => (n.head ? [{ nodeId: n.id, version: n.head }] : []));
