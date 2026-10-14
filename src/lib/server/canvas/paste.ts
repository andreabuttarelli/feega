import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { createConnection, createNode } from '$lib/server/repos/canvas';
import { validateNodeData } from '$lib/canvas/node-data';

export type PastedNode = { type: string; data: Record<string, unknown>; x: number; y: number };

export type PastedEdge = { sourceIndex: number; targetIndex: number; sourceHandle: string | null; targetHandle: string | null };

export type Pasted =
  | { nodes: Awaited<ReturnType<typeof createNode>>[]; connections: Awaited<ReturnType<typeof createConnection>>[] }
  | { refused: string };

export async function pasteNodes(
  db: Db,
  input: { orgId: string; projectId: string; canvasId: string; nodes: PastedNode[]; edges: PastedEdge[]; actor: Actor }
): Promise<Pasted> {
  const nodes: Awaited<ReturnType<typeof createNode>>[] = [];
  for (const p of input.nodes) {
    const verdict = validateNodeData(p.type, p.data);
    if (!verdict.ok) {
      return { refused: verdict.error };
    }

    nodes.push(
      await createNode(db, {
        orgId: input.orgId,
        projectId: input.projectId,
        canvasId: input.canvasId,
        type: p.type,
        x: p.x,
        y: p.y,
        data: verdict.data,
        actor: input.actor
      })
    );
  }

  const connections: Awaited<ReturnType<typeof createConnection>>[] = [];
  for (const e of input.edges) {
    const source = nodes[e.sourceIndex];
    const target = nodes[e.targetIndex];
    if (!source || !target) {
      continue;
    }
    connections.push(
      await createConnection(db, {
        orgId: input.orgId,
        canvasId: input.canvasId,
        sourceNodeId: source.id,
        targetNodeId: target.id,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        actor: input.actor
      })
    );
  }

  return { nodes, connections };
}
