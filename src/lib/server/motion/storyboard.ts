import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { createCanvas, deleteNode, findNode, listConnections, listNodes, patchNodeData, DataCheck } from '$lib/server/repos/canvas';
import { writePlan } from '$lib/server/canvas/duplicate';
import { planStoryboard, readStoryboard, type MediaKind, type Storyboard } from '$lib/motion/storyboard';
import { motionEditorPath, storyboardOf } from '$lib/canvas/motion-node';
import type { StoryboardPort } from './motion-tools';

type Scope = { orgId: string; projectId: string; motionNodeId: string; title: string; actor: Actor };

const EDITABLE: Record<string, string> = { doc: 'content', text: 'prompt' };

const NOT_A_CARD = { ok: false as const, error: 'not a card of this storyboard: read_storyboard lists them' };

export function storyboardStore(db: Db, scope: Scope): StoryboardPort {
  const link = async () => {
    const motion = await findNode(db, { orgId: scope.orgId, nodeId: scope.motionNodeId });
    return motion ? storyboardOf(motion.data) : null;
  };

  const card = async (nodeId: string) => {
    const motion = await findNode(db, { orgId: scope.orgId, nodeId: scope.motionNodeId });
    const linked = motion ? storyboardOf(motion.data) : null;
    const node = await findNode(db, { orgId: scope.orgId, nodeId });
    const field = node ? EDITABLE[node.type] : undefined;
    return motion && linked && node && node.canvasId === linked.canvasId && field ? { motion, field } : null;
  };

  const save = async (nodeId: string, patch: Record<string, unknown>) => {
    const written = await patchNodeData(db, { orgId: scope.orgId, nodeId, patch, check: DataCheck.Schema, actor: scope.actor });
    return written.outcome === 'written' ? { ok: true as const } : { ok: false as const, error: `the card was not saved (${written.outcome})` };
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
      const found = await card(nodeId);
      return found ? save(nodeId, { [found.field]: text }) : NOT_A_CARD;
    },

    async link(nodeId: string, clipIds: string[]) {
      const found = await card(nodeId);
      if (!found) {
        return NOT_A_CARD;
      }
      const editor = motionEditorPath({ projectId: found.motion.projectId, canvasId: found.motion.canvasId, nodeId: found.motion.id });
      return save(nodeId, { beat: { editor, clipIds } });
    }
  };
}
