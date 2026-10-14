import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { listNodes, writeNodeData, type CanvasNodeRecord } from '$lib/server/repos/canvas';

export type BatchItem = { node_id: string; version: number; patch: Record<string, unknown> };

export type BatchResult = { nodeId: string; outcome: 'written' | 'conflict' | 'not_found'; node?: CanvasNodeRecord };

export async function writeNodesBatch(
  db: Db,
  input: { orgId: string; canvasId: string; items: BatchItem[]; actor: Actor }
): Promise<BatchResult[]> {
  const known = new Map((await listNodes(db, input)).map((node) => [node.id, node]));

  const results: BatchResult[] = [];
  for (const item of input.items) {
    const current = known.get(item.node_id);
    if (!current) {
      results.push({ nodeId: item.node_id, outcome: 'not_found' });
      continue;
    }

    const written = await writeNodeData(db, {
      orgId: input.orgId,
      nodeId: item.node_id,
      data: { ...current.data, ...item.patch },
      expectedVersion: item.version,
      actor: input.actor
    });

    results.push(
      written.outcome === 'conflict'
        ? { nodeId: item.node_id, outcome: 'conflict' }
        : { nodeId: item.node_id, outcome: 'written', node: written.node }
    );
  }

  return results;
}
