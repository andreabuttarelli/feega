import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { deleteConnection, deleteNode, listConnections, listNodes, restoreConnection, restoreNode } from '$lib/server/repos/canvas';
import { readHead } from '$lib/server/repos/motion-revisions';
import { saveMotionDoc } from '$lib/server/motion/editor';
import { MAX_VERSION_NAME, planCanvasRestore, snapshotSchema, type CanvasSnapshot } from '$lib/canvas/canvas-version';

type Scope = { orgId: string; canvasId: string };

export type CanvasVersion = { id: string; name: string; createdAt: string; nodes: number };

type Row = { id: string; name: string; created_at: string; snapshot: unknown };

type VersionTable = {
  from: (table: 'canvas_versions') => {
    insert: (row: Record<string, unknown>) => { select: (cols: string) => { single: () => Promise<{ data: Row | null; error: unknown }> } };
    select: (cols: string) => {
      eq: (col: string, v: string) => {
        eq: (col: string, v: string) => {
          order: (col: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: Row[] | null; error: unknown }> };
          maybeSingle: () => Promise<{ data: Row | null; error: unknown }>;
        };
      };
    };
  };
};

const LIST_LIMIT = 50;
const BEFORE_RESTORE = 'Before restoring';

const versions = (db: Db) => db as unknown as VersionTable;

export async function versionSnapshot(db: Db, scope: Scope): Promise<CanvasSnapshot> {
  const [nodes, connections] = await Promise.all([listNodes(db, scope), listConnections(db, scope)]);
  const motion = nodes.filter((n) => n.type === 'motion');
  const heads = await Promise.all(motion.map(async (n) => [n.id, await readHead(db, { orgId: scope.orgId, nodeId: n.id })] as const));
  return {
    nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, size: n.size, data: n.data })),
    connections: connections.map((c) => ({ id: c.id, sourceNodeId: c.sourceNodeId, targetNodeId: c.targetNodeId })),
    heads: Object.fromEntries(heads.flatMap(([id, head]) => (head ? [[id, { version: head.version, doc: head.doc }]] : [])))
  };
}

const versionOf = (row: Row): CanvasVersion => {
  const parsed = snapshotSchema.safeParse(row.snapshot);
  return { id: row.id, name: row.name, createdAt: row.created_at, nodes: parsed.success ? parsed.data.nodes.length : 0 };
};

export async function saveCanvasVersion(db: Db, input: Scope & { name: string; actor: Actor }): Promise<CanvasVersion> {
  const snapshot = await versionSnapshot(db, input);
  const name = input.name.trim().slice(0, MAX_VERSION_NAME) || new Date().toISOString();
  const { data, error } = await versions(db)
    .from('canvas_versions')
    .insert({ org_id: input.orgId, canvas_id: input.canvasId, name, snapshot, actor_kind: input.actor.kind, actor_id: input.actor.id, agent_key: input.actor.agentKey ?? null })
    .select('id, name, created_at, snapshot')
    .single();
  if (error || !data) {
    throw error ?? new Error('canvas version not saved');
  }
  return versionOf(data);
}

export async function listCanvasVersions(db: Db, scope: Scope): Promise<CanvasVersion[]> {
  const { data, error } = await versions(db).from('canvas_versions').select('id, name, created_at, snapshot').eq('org_id', scope.orgId).eq('canvas_id', scope.canvasId).order('created_at', { ascending: false }).limit(LIST_LIMIT);
  if (error) {
    throw error;
  }
  return (data ?? []).map(versionOf);
}

export enum RestoreOutcome {
  Restored = 'restored',
  Missing = 'missing'
}

export async function restoreCanvasVersion(db: Db, input: Scope & { versionId: string; actor: Actor }): Promise<{ outcome: RestoreOutcome; changed?: number }> {
  const { data } = await versions(db).from('canvas_versions').select('id, name, created_at, snapshot').eq('org_id', input.orgId).eq('id', input.versionId).maybeSingle();
  const target = data ? snapshotSchema.safeParse(data.snapshot) : null;
  if (!data || !target?.success) {
    return { outcome: RestoreOutcome.Missing };
  }

  await saveCanvasVersion(db, { ...input, name: `${BEFORE_RESTORE} ${data.name}` });
  const current = await versionSnapshot(db, input);
  const plan = planCanvasRestore(current, target.data);
  const actor = input.actor;

  for (const id of plan.disconnect) {
    await deleteConnection(db, { orgId: input.orgId, connectionId: id, actor });
  }
  for (const id of plan.remove) {
    await deleteNode(db, { orgId: input.orgId, nodeId: id, actor });
  }
  for (const n of plan.put) {
    await restoreNode(db, { orgId: input.orgId, nodeId: n.id, position: n.position, size: n.size, data: n.data, actor });
  }
  for (const id of plan.reconnect) {
    await restoreConnection(db, { orgId: input.orgId, connectionId: id, actor });
  }
  for (const d of plan.docs) {
    const head = await readHead(db, { orgId: input.orgId, nodeId: d.nodeId });
    await saveMotionDoc(db, { orgId: input.orgId, nodeId: d.nodeId, expectedVersion: head?.version ?? 0, doc: d.doc, actor, summary: `Restored canvas version ${data.name}` });
  }
  return { outcome: RestoreOutcome.Restored, changed: plan.put.length + plan.remove.length + plan.reconnect.length + plan.disconnect.length + plan.docs.length };
}
