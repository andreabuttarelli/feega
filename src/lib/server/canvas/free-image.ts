import type { Db } from '$lib/server/db/client';
import { freeImageAssetId } from '$lib/canvas/free-image';
import { readRevision } from '$lib/server/repos/motion-revisions';

export async function freeImageAssetOf(db: Db, input: { orgId: string; node: { id: string; data: Record<string, unknown> } }): Promise<string | null> {
  const version = Number(input.node.data.docHeadRevision);
  const head = await readRevision(db, { orgId: input.orgId, nodeId: input.node.id, version });

  return freeImageAssetId(head?.doc ?? null);
}
