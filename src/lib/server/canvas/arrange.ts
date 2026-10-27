import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { listNodes, moveNode } from '$lib/server/repos/canvas';
import { nodeSize } from '$lib/canvas/node-size';
import type { TileBox, TileMove } from '$lib/canvas/align';

export type Arranged = { moved: TileMove[]; missing: string[] };

export async function arrangeNodes(
  db: Db,
  input: { orgId: string; canvasId: string; nodeIds: string[]; actor: Actor; plan: (tiles: TileBox[]) => TileMove[] }
): Promise<Arranged> {
  const wanted = new Set(input.nodeIds);
  const nodes = (await listNodes(db, { orgId: input.orgId, canvasId: input.canvasId })).filter((node) => wanted.has(node.id));
  const tiles = nodes.map((node) => {
    const fallback = nodeSize(node.type, node.data);
    return { id: node.id, x: node.position.x, y: node.position.y, width: node.size.width ?? fallback.w, height: node.size.height ?? fallback.h };
  });

  const moved = input.plan(tiles);
  for (const move of moved) {
    await moveNode(db, { orgId: input.orgId, nodeId: move.id, x: move.x, y: move.y, actor: input.actor });
  }

  const found = new Set(nodes.map((node) => node.id));
  return { moved, missing: input.nodeIds.filter((id) => !found.has(id)) };
}
