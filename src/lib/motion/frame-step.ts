import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { applyOps, diffDoc, type DocOp } from './doc-ops';
import { mentionedIds } from './doc-assets';
import type { Revision } from './frame-sync';

export type PeerStep = { nodeId: string; base: number; version: number; ops: DocOp[] };

export type HeldSource = Revision & { assets: Record<string, string> };

export function stepOf(nodeId: string, from: Revision, to: Revision): PeerStep | null {
  if (to.version !== from.version + 1) {
    return null;
  }
  const ops = diffDoc(from.doc, to.doc);
  return ops.length ? { nodeId, base: from.version, version: to.version, ops } : null;
}

export function nextDoc(held: HeldSource, step: PeerStep): MotionDoc | null {
  if (held.version !== step.base) {
    return null;
  }
  const doc = applyOps(held.doc, step.ops);
  const known = new Set([...mentionedIds(held.doc), ...Object.keys(held.assets)]);
  return mentionedIds(doc).every((id) => known.has(id)) ? doc : null;
}
