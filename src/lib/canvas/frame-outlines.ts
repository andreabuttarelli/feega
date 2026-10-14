import { z } from 'zod';
import { CUSTOM_CLIP, partBoxes } from '$lib/motion/poster-parts';
import type { MeasuredBox } from '$lib/motion/hyperframes/measure';
import type { FrameOutlines, LayerRow } from './layers';

export const HEADS_PARAM = 'heads';
export const PARTS_PARAM = 'parts';
const MAX_PARTS = 200;

export type ClipParts = Record<string, readonly string[]>;
export type FrameParts = Record<string, ClipParts>;

const framePartsSchema = z.record(z.string(), z.record(z.string(), z.array(z.string().max(MAX_PARTS)).max(MAX_PARTS)));

export function parseParts(raw: string): FrameParts {
  try {
    const parsed = framePartsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}
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

export const posterHeads = (heads: readonly FrameHead[], cache: OutlineCache, probed: ReadonlySet<string>, openNodeId: string | null) =>
  heads.filter((h) => h.nodeId !== openNodeId && !probed.has(headKey(h)) && (cache[headKey(h)] ?? []).some((r) => r.type === CUSTOM_CLIP));

export const partIds = (boxes: Record<string, MeasuredBox>): ClipParts =>
  Object.fromEntries(Object.entries(partBoxes(boxes).parts).map(([clip, list]) => [clip, list.map((p) => p.part)]));

export const partsParam = (nodeId: string, parts: ClipParts) => JSON.stringify({ [nodeId]: parts });
