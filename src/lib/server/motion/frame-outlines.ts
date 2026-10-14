import type { Db } from '$lib/server/db/client';
import { readHeads } from '$lib/server/repos/motion-revisions';
import { frameRows, type FrameOutlines } from '$lib/canvas/layers';
import type { FrameHead } from '$lib/canvas/frame-outlines';

export async function frameOutlines(db: Db, input: { orgId: string; heads: FrameHead[] }): Promise<FrameOutlines> {
  const heads = await readHeads(db, input);
  return Object.fromEntries([...heads].map(([nodeId, head]) => [nodeId, frameRows(head.doc, nodeId)]));
}
