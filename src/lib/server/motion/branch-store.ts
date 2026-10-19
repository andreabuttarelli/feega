import { z } from 'zod';
import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { createNode, deleteNode, findNode, listBranchNodes, type CanvasNodeRecord } from '$lib/server/repos/canvas';
import { appendRevision, readHead, readRevision } from '$lib/server/repos/motion-revisions';
import { motionOf } from '$lib/canvas/motion-node';
import { OpsOutcome, commitDoc } from './frame-ops';
import type { BranchStore, Fork } from './branches';

const MERGE_SUMMARY = 'Merged a branch';
const FIRST_REVISION = 1;

const branchOfSchema = z.object({ nodeId: z.string().min(1), baseVersion: z.number().int().min(0), name: z.string() });

export function forkOf(record: CanvasNodeRecord | null): Fork | null {
  const parsed = branchOfSchema.safeParse(record?.data.branchOf);
  return record && parsed.success ? { id: record.id, frameId: parsed.data.nodeId, name: parsed.data.name, baseVersion: parsed.data.baseVersion } : null;
}

export function branchStore(db: Db, scope: { orgId: string; actor: Actor }): BranchStore {
  const { orgId, actor } = scope;
  return {
    head: async (nodeId) => {
      const head = await readHead(db, { orgId, nodeId });
      return head ? { version: head.version, doc: head.doc } : null;
    },
    revision: async (nodeId, version) => (await readRevision(db, { orgId, nodeId, version }))?.doc ?? null,
    fork: async (frameId, name, head) => {
      const frame = await findNode(db, { orgId, nodeId: frameId });
      if (!frame) {
        throw new Error('frame_not_found');
      }
      const branch = await createNode(db, {
        orgId,
        projectId: frame.projectId,
        canvasId: frame.canvasId,
        type: 'motion',
        x: frame.position.x,
        y: frame.position.y,
        displayName: name,
        width: frame.size.width ?? undefined,
        height: frame.size.height ?? undefined,
        data: { ...frame.data, docHeadRevision: FIRST_REVISION, branchOf: { nodeId: frameId, baseVersion: head.version, name } },
        actor
      });
      await appendRevision(db, { orgId, nodeId: branch.id, expectedVersion: 0, doc: head.doc, actor, summary: `Branched from version ${head.version}` });
      return branch.id;
    },
    forkOf: async (branchId) => forkOf(await findNode(db, { orgId, nodeId: branchId })),
    forks: async (frameId) => {
      const frame = await findNode(db, { orgId, nodeId: frameId });
      if (!frame) {
        return [];
      }
      return (await listBranchNodes(db, { orgId, canvasId: frame.canvasId })).flatMap((n) => {
        const fork = forkOf(n);
        return fork && fork.frameId === frameId ? [fork] : [];
      });
    },
    commit: async (nodeId, base, doc) => {
      const record = await findNode(db, { orgId, nodeId });
      const node = record ? motionOf(record) : null;
      if (!node) {
        throw new Error('frame_not_found');
      }
      const out = await commitDoc(db, { orgId, nodeId, node, base, doc, actor, summary: MERGE_SUMMARY });
      if (out.outcome !== OpsOutcome.Written) {
        throw new Error(out.outcome === OpsOutcome.Invalid ? out.error : 'merge_busy');
      }
      return out.head.version;
    },
    drop: (branchId) => deleteNode(db, { orgId, nodeId: branchId, actor })
  };
}
