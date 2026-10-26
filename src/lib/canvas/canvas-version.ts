import { z } from 'zod';

const nodeSnapshot = z.object({
  id: z.string(),
  type: z.string(),
  position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  size: z.object({ width: z.number().nullable(), height: z.number().nullable() }),
  data: z.record(z.string(), z.unknown())
});

const connectionSnapshot = z.object({ id: z.string(), sourceNodeId: z.string(), targetNodeId: z.string() });

export const snapshotSchema = z.object({
  nodes: z.array(nodeSnapshot),
  connections: z.array(connectionSnapshot),
  heads: z.record(z.string(), z.object({ version: z.number(), doc: z.unknown() }))
});

export type CanvasSnapshot = z.infer<typeof snapshotSchema>;
export type NodeSnapshot = z.infer<typeof nodeSnapshot>;

export type RestorePlan = { put: NodeSnapshot[]; remove: string[]; reconnect: string[]; disconnect: string[]; docs: { nodeId: string; doc: unknown }[] };

export const MAX_VERSION_NAME = 60;

const sameNode = (a: NodeSnapshot, b: NodeSnapshot | undefined) => !!b && JSON.stringify(a) === JSON.stringify(b);

export function planCanvasRestore(current: CanvasSnapshot, target: CanvasSnapshot): RestorePlan {
  const now = new Map(current.nodes.map((n) => [n.id, n]));
  const kept = new Set(target.nodes.map((n) => n.id));
  const nowEdges = new Set(current.connections.map((c) => c.id));
  const keptEdges = new Set(target.connections.map((c) => c.id));

  return {
    put: target.nodes.filter((n) => !sameNode(n, now.get(n.id))),
    remove: current.nodes.filter((n) => !kept.has(n.id)).map((n) => n.id),
    reconnect: target.connections.filter((c) => !nowEdges.has(c.id)).map((c) => c.id),
    disconnect: current.connections.filter((c) => !keptEdges.has(c.id)).map((c) => c.id),
    docs: Object.entries(target.heads)
      .filter(([id, head]) => current.heads[id]?.version !== head.version)
      .map(([nodeId, head]) => ({ nodeId, doc: head.doc }))
  };
}
