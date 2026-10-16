import { listNodes, moveNode } from '$lib/server/repos/canvas';
import { z } from 'zod';
import { Stack, restacked } from '$lib/canvas/stacking';

export const restackAskSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(200), to: z.enum(Stack) }).strict();

type Db = Parameters<typeof listNodes>[0];
type Scope = Parameters<typeof listNodes>[1];
type Actor = NonNullable<Parameters<typeof moveNode>[1]['actor']>;

export async function restackNodes(db: Db, scope: Scope, actor: Actor, ids: readonly string[], to: Stack): Promise<number> {
  const nodes = await listNodes(db, scope);
  const placed = new Map(nodes.map((n) => [n.id, n.position]));
  const moves = restacked(nodes.map((n) => ({ id: n.id, z: n.position.z })), ids, to);
  await Promise.all(moves.map(({ id, z }) => moveNode(db, { orgId: scope.orgId, nodeId: id, x: placed.get(id)!.x, y: placed.get(id)!.y, z, actor })));
  return moves.length;
}
