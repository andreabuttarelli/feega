import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { frameRows, type FrameOutlines, type LayerRow } from './layers';
import { DocNodeType } from './motion-node';

export type FrameHead = { nodeId: string; version: number };

export type HeldDocs = ReadonlyMap<string, MotionDoc>;

const built = new WeakMap<MotionDoc, { nodeId: string; rows: LayerRow[] }>();

function rowsOf(doc: MotionDoc, nodeId: string): LayerRow[] {
  const hit = built.get(doc);
  if (hit?.nodeId === nodeId) {
    return hit.rows;
  }
  const rows = frameRows(doc, nodeId);
  built.set(doc, { nodeId, rows });
  return rows;
}

export function heldOutlines(heads: readonly FrameHead[], docs: HeldDocs): FrameOutlines {
  return Object.fromEntries(
    heads.flatMap((h) => {
      const doc = docs.get(h.nodeId);
      return doc ? [[h.nodeId, rowsOf(doc, h.nodeId)]] : [];
    })
  );
}

const DOC_TYPES: ReadonlySet<string> = new Set(Object.values(DocNodeType));

export function frameHead(type: string, data: Record<string, unknown>): number | null {
  const version = Number(data.docHeadRevision);
  return DOC_TYPES.has(type) && Number.isInteger(version) && version > 0 ? version : null;
}

export const canvasHeads = (nodes: readonly { id: string; head?: number | null }[]): FrameHead[] => nodes.flatMap((n) => (n.head ? [{ nodeId: n.id, version: n.head }] : []));
