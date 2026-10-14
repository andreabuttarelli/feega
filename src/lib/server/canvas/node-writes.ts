import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { deleteConnection, deleteNode, findNode, listConnections, listNodes, resizeNode, writeNodeData, type CanvasNodeRecord } from '$lib/server/repos/canvas';
import { clearDocShare, setDocShare } from '$lib/server/repos/doc-share';
import { runsOf } from '$lib/server/canvas/generate';
import { nodeSize } from '$lib/canvas/node-size';
import { docData } from '$lib/canvas-node-data';
import { mintShareToken } from '$lib/canvas/doc-node';

type CanvasScope = { orgId: string; canvasId: string };

export async function removeNodes(db: Db, input: CanvasScope & { nodeIds: string[]; actor: Actor }): Promise<boolean> {
  const onCanvas = new Set((await listNodes(db, input)).map((node) => node.id));
  if (input.nodeIds.some((id) => !onCanvas.has(id))) {
    return false;
  }

  const connectionIds = (await listConnections(db, input))
    .filter((edge) => input.nodeIds.includes(edge.sourceNodeId) || input.nodeIds.includes(edge.targetNodeId))
    .map((edge) => edge.id);

  for (const connectionId of connectionIds) {
    await deleteConnection(db, { orgId: input.orgId, connectionId, actor: input.actor });
  }
  for (const nodeId of input.nodeIds) {
    await deleteNode(db, { orgId: input.orgId, nodeId, actor: input.actor });
  }
  return true;
}

export async function resizeOnCanvas(db: Db, input: CanvasScope & { nodeId: string; width: number; height: number }): Promise<boolean> {
  const existing = (await listNodes(db, input)).find((node) => node.id === input.nodeId);
  if (!existing) {
    return false;
  }

  const min = nodeSize(existing.type, existing.data);
  await resizeNode(db, {
    orgId: input.orgId,
    nodeId: input.nodeId,
    width: Math.max(min.w, input.width),
    height: Math.max(min.h, input.height)
  });
  return true;
}

export type DocShared = { public: false } | { public: true; path: string };

export async function shareDoc(db: Db, input: CanvasScope & { nodeId: string; on: boolean }): Promise<DocShared | null> {
  const node = (await listNodes(db, input)).find((row) => row.id === input.nodeId);
  if (!node || node.type !== 'doc') {
    return null;
  }

  const data = docData({
    id: node.id,
    content: typeof node.data.content === 'string' ? node.data.content : '',
    public: input.on
  });

  if (!input.on) {
    await clearDocShare(db, { orgId: input.orgId, nodeId: input.nodeId, data });
    return { public: false };
  }

  const { token, token_hash } = await mintShareToken();
  await setDocShare(db, { orgId: input.orgId, nodeId: input.nodeId, data, tokenHash: token_hash, expiresAt: null });
  return { public: true, path: `/d/${token}` };
}

export enum ShowRun {
  Shown = 'shown',
  NodeMissing = 'node_missing',
  RunMissing = 'run_missing',
  Conflict = 'conflict'
}

export type RunShown = { outcome: ShowRun.Shown; node: CanvasNodeRecord } | { outcome: Exclude<ShowRun, ShowRun.Shown> };

const SHOWS_RUNS = new Set(['text', 'image', 'video']);

export async function showRun(db: Db, input: { orgId: string; nodeId: string; runId: string; actor: Actor }): Promise<RunShown> {
  const node = await findNode(db, { orgId: input.orgId, nodeId: input.nodeId });
  if (!node || !SHOWS_RUNS.has(node.type)) {
    return { outcome: ShowRun.NodeMissing };
  }

  const run = (await runsOf(db, { orgId: input.orgId, nodeId: input.nodeId })).find((r) => r.id === input.runId);
  if (!run?.outputAssetId) {
    return { outcome: ShowRun.RunMissing };
  }

  const shown = await writeNodeData(db, {
    orgId: input.orgId,
    nodeId: input.nodeId,
    expectedVersion: node.version,
    data: { ...node.data, refId: run.outputAssetId, runId: run.id, running: false, error: null },
    actor: input.actor
  });
  return shown.outcome === 'conflict' ? { outcome: ShowRun.Conflict } : { outcome: ShowRun.Shown, node: shown.node };
}
