import type { Db } from '$lib/server/db/client';
import { readHeads } from '$lib/server/repos/motion-revisions';
import { frameRows, type FrameOutlines } from '$lib/canvas/layers';
import { staticParts } from './static-parts';
import type { FrameHead, FrameParts } from '$lib/canvas/frame-outlines';

export async function frameOutlines(db: Db, input: { orgId: string; heads: FrameHead[]; parts?: FrameParts }): Promise<FrameOutlines> {
  const heads = await readHeads(db, { orgId: input.orgId, heads: input.heads });
  return Object.fromEntries([...heads].map(([nodeId, head]) => [nodeId, frameRows(head.doc, nodeId, input.parts?.[nodeId] ?? staticParts(head.doc))]));
}

