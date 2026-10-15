import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { DataCheck, findNode, listNodes, moveNode, patchNodeData, type CanvasNodeRecord } from '$lib/server/repos/canvas';
import { layoutOf } from '$lib/canvas/node-layout';
import { nodeSize } from '$lib/canvas/node-size';
import type { Member, Members } from './element-groups';

function memberOf(record: CanvasNodeRecord): Member {
  const fallback = nodeSize(record.type, record.data);
  const layout = layoutOf(record.data);
  return {
    id: record.id,
    box: { left: record.position.x, top: record.position.y, width: record.size.width ?? fallback.w, height: record.size.height ?? fallback.h },
    rotation: layout.rotation,
    groupId: layout.groupId,
    version: record.version,
    data: record.data
  };
}

const BEHIND_Z = -1;

export function nodeMembers(db: Db, scope: { orgId: string; canvasId: string; actor: Actor }): Members {
  const { orgId, canvasId, actor } = scope;
  return {
    read: async (ids) => (await Promise.all(ids.map((nodeId) => findNode(db, { orgId, nodeId })))).flatMap((r) => (r ? [memberOf(r)] : [])),
    inGroup: async (groupId) => (await listNodes(db, { orgId, canvasId })).map(memberOf).filter((m) => m.groupId === groupId),
    join: async (nodeId, groupId) => {
      const before = await findNode(db, { orgId, nodeId });
      const written = before ? await patchNodeData(db, { orgId, nodeId, patch: { groupId }, check: DataCheck.Schema, actor }) : null;
      if (!before || written?.outcome !== 'written') {
        return null;
      }
      return { kind: 'node.update', nodeId, before: { data: before.data }, after: { data: written.node.data }, expectedVersion: written.node.version };
    },
    sendBack: async (nodeId) => {
      const node = await findNode(db, { orgId, nodeId });
      if (node) {
        await moveNode(db, { orgId, nodeId, x: node.position.x, y: node.position.y, z: BEHIND_Z, actor });
      }
    },
    place: async (nodeId, at) => {
      await moveNode(db, { orgId, nodeId, x: at.x, y: at.y, actor });
      await patchNodeData(db, { orgId, nodeId, patch: { rotation: at.rotation }, check: DataCheck.Schema, actor });
    }
  };
}
