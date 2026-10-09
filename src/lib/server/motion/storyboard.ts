import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { createCanvas, deleteNode, findNode, listConnections, listNodes, patchNodeData, DataCheck } from '$lib/server/repos/canvas';
import { writePlan } from '$lib/server/canvas/duplicate';
import { planStoryboard, readStoryboard, type MediaKind, type Storyboard } from '$lib/motion/storyboard';
import { storyboardOf } from '$lib/canvas/motion-node';
import type { StoryboardPort } from './motion-tools';

type Scope = { orgId: string; projectId: string; motionNodeId: string; title: string; actor: Actor };

const EDITABLE: Record<string, string> = { doc: 'content', text: 'prompt' };

export function storyboardStore(db: Db, scope: Scope): StoryboardPort {
  const link = async () => {
    const motion = await findNode(db, { orgId: scope.orgId, nodeId: scope.motionNodeId });
    return motion ? storyboardOf(motion.data) : null;
  };

  return {
    async write(board: Storyboard, media: Record<string, MediaKind>) {
      const before = await link();
      const canvasId = before?.canvasId ?? (await createCanvas(db, { orgId: scope.orgId, projectId: scope.projectId, name: `${scope.title} · storyboard` })).id;

      for (const nodeId of before?.placed ?? []) {
        await deleteNode(db, { orgId: scope.orgId, nodeId, actor: scope.actor });
      }

      const written = await writePlan(db, { orgId: scope.orgId, projectId: scope.projectId, canvasId, actor: scope.actor }, planStoryboard(board, media));
      const placed = written.nodes.map((n) => n.id);
      await patchNodeData(db, { orgId: scope.orgId, nodeId: scope.motionNodeId, patch: { storyboard: { canvasId, placed } }, check: DataCheck.None, actor: scope.actor });

      return { canvasId, nodes: placed.length, connections: written.connections.length };
    },

    async read() {
      const linked = await link();
      if (!linked) {
        return null;
      }

      const [nodes, edges] = await Promise.all([listNodes(db, { orgId: scope.orgId, canvasId: linked.canvasId }), listConnections(db, { orgId: scope.orgId, canvasId: linked.canvasId })]);
      return { canvasId: linked.canvasId, ...readStoryboard(nodes, edges) };
    },

    async edit(nodeId: string, text: string) {
      const linked = await link();
      const node = await findNode(db, { orgId: scope.orgId, nodeId });
      const field = node ? EDITABLE[node.type] : undefined;
      if (!linked || !node || node.canvasId !== linked.canvasId || !field) {
        return { ok: false as const, error: 'not a card of this storyboard: read_storyboard lists them' };
      }

      const written = await patchNodeData(db, { orgId: scope.orgId, nodeId, patch: { [field]: text }, check: DataCheck.Schema, actor: scope.actor });
      return written.outcome === 'written' ? { ok: true as const } : { ok: false as const, error: `the card was not saved (${written.outcome})` };
    }
  };
}
