import type { Db } from '$lib/server/db/client';
import { listMotionNodes } from '$lib/server/repos/canvas';
import { motionOf } from '$lib/canvas/motion-node';
import { memoryNote, studioMemory } from '$lib/motion/studio-memory';
import { headOrNew } from './editor';

export async function projectMemory(db: Db, scope: { orgId: string; projectId: string; nodeId: string }): Promise<string> {
  const records = await listMotionNodes(db, { orgId: scope.orgId, projectId: scope.projectId });
  const last = records.find((r) => r.id !== scope.nodeId);
  const node = last ? motionOf(last) : null;
  if (!last || !node) {
    return '';
  }
  const head = await headOrNew(db, { orgId: scope.orgId, nodeId: last.id }, node);
  return memoryNote(studioMemory(head.doc));
}
