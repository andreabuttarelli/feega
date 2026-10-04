import type { Db } from '$lib/server/db/client';
import { createCanvas, createConnection, createNode, listCanvases, listNodes, type CanvasNodeRecord } from '$lib/server/repos/canvas';
import { findAsset } from '$lib/server/repos/assets';
import { registerCanvasUpload } from '$lib/server/canvas/upload';
import { runGenNode } from '$lib/server/canvas/generate';
import { OPENROUTER_UPSCALE_MODEL, upscaleLimitsOf } from '$lib/video-models';
import { planUpscale, upscaleParams, type UpscaleMode, type UpscaleRefusal, type UpscaleTarget } from '$lib/upscale';

export const UPSCALE_CANVAS_NAME = 'Upscale';

const SOURCE_HANDLE = 'videos';
const COLUMN_GAP = 480;
const ROW_GAP = 80;

export type UpscaleStartDeps = {
  listCanvases: typeof listCanvases;
  listNodes: typeof listNodes;
  createCanvas: typeof createCanvas;
  registerCanvasUpload: typeof registerCanvasUpload;
  findAsset: typeof findAsset;
  createNode: typeof createNode;
  createConnection: typeof createConnection;
  runGenNode: typeof runGenNode;
};

export const UPSCALE_START_DEPS: UpscaleStartDeps = {
  listCanvases,
  listNodes,
  createCanvas,
  registerCanvasUpload,
  findAsset,
  createNode,
  createConnection,
  runGenNode
};

export type UpscaleSourceInput =
  | { kind: 'upload'; path: string; fileName: string; mimeType: string; bytes: number }
  | { kind: 'asset'; assetId: string };

export type UpscaleProbe = { width: number; height: number; seconds: number };

type StartInput = {
  orgId: string;
  projectId: string;
  userId: string;
  source: UpscaleSourceInput;
  probe: UpscaleProbe;
  target: UpscaleTarget;
  mode: UpscaleMode;
};

export type UpscaleStart = { ok: true; canvasId: string; nodeId: string } | { ok: false; error: UpscaleRefusal | string };

type SourceFacts = { bytes: number; mimeType: string };

async function factsOf(db: Db, deps: UpscaleStartDeps, input: StartInput): Promise<SourceFacts | null> {
  if (input.source.kind === 'upload') {
    return { bytes: input.source.bytes, mimeType: input.source.mimeType };
  }

  const asset = await deps.findAsset(db, { orgId: input.orgId, assetId: input.source.assetId });
  if (!asset || asset.type !== 'video' || asset.projectId !== input.projectId) {
    return null;
  }
  return { bytes: asset.bytes ?? 0, mimeType: asset.mimeType ?? '' };
}

async function upscaleCanvasId(db: Db, deps: UpscaleStartDeps, input: StartInput): Promise<string> {
  const canvases = await deps.listCanvases(db, { orgId: input.orgId, projectId: input.projectId });
  const dedicated = canvases.find((c) => c.name === UPSCALE_CANVAS_NAME);
  if (dedicated) {
    return dedicated.id;
  }
  return (await deps.createCanvas(db, { orgId: input.orgId, projectId: input.projectId, name: UPSCALE_CANVAS_NAME })).id;
}

async function placeSource(db: Db, deps: UpscaleStartDeps, input: StartInput, canvasId: string, y: number): Promise<string> {
  const scope = { orgId: input.orgId, projectId: input.projectId, canvasId };
  if (input.source.kind === 'upload') {
    const { node } = await deps.registerCanvasUpload(db, { ...scope, ...input.source, x: 0, y });
    return node.id;
  }

  const asset = await deps.findAsset(db, { orgId: input.orgId, assetId: input.source.assetId });
  const node = await deps.createNode(db, {
    ...scope,
    type: 'video',
    x: 0,
    y,
    data: { assetId: input.source.assetId, url: `/p/${input.projectId}/c/${canvasId}/assets/${input.source.assetId}`, name: 'Source clip', mimeType: asset?.mimeType ?? 'video/mp4' },
    actor: { kind: 'user', id: input.userId }
  });
  return node.id;
}

function rowBelow(nodes: CanvasNodeRecord[]): number {
  const bottoms = nodes.map((n) => n.position.y + (n.size.height ?? 0));
  return bottoms.length ? Math.max(...bottoms) + ROW_GAP : 0;
}

export async function startUpscale(db: Db, deps: UpscaleStartDeps, input: StartInput): Promise<UpscaleStart> {
  const facts = await factsOf(db, deps, input);
  if (!facts) {
    return { ok: false, error: 'source_not_found' };
  }

  const plan = planUpscale({ ...input.probe, ...facts }, input.target, upscaleLimitsOf(OPENROUTER_UPSCALE_MODEL)!);
  if (!plan.ok) {
    return plan;
  }

  const canvasId = await upscaleCanvasId(db, deps, input);
  const y = rowBelow(await deps.listNodes(db, { orgId: input.orgId, canvasId }));
  const sourceNodeId = await placeSource(db, deps, input, canvasId, y);

  const params = { ...upscaleParams(plan.factor, input.mode), duration: Math.max(1, Math.ceil(input.probe.seconds)) };
  const node = await deps.createNode(db, {
    orgId: input.orgId,
    projectId: input.projectId,
    canvasId,
    type: 'video',
    x: COLUMN_GAP,
    y,
    displayName: `Upscale ${plan.width}×${plan.height}`,
    data: { prompt: '', model: OPENROUTER_UPSCALE_MODEL, params },
    actor: { kind: 'user', id: input.userId }
  });
  await deps.createConnection(db, {
    orgId: input.orgId,
    canvasId,
    sourceNodeId,
    targetNodeId: node.id,
    targetHandle: SOURCE_HANDLE,
    actor: { kind: 'user', id: input.userId }
  });

  const run = await deps.runGenNode(db, {
    orgId: input.orgId,
    projectId: input.projectId,
    canvasId,
    nodeId: node.id,
    userId: input.userId,
    medium: 'video',
    prompt: '',
    model: OPENROUTER_UPSCALE_MODEL,
    params: params as never,
    expectedVersion: node.version
  });
  if (run.kind === 'refused') {
    return { ok: false, error: run.error };
  }
  return { ok: true, canvasId, nodeId: node.id };
}
