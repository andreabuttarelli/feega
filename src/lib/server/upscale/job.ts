import type { Db } from '$lib/server/db/client';
import { findNode, listConnections, listNodes } from '$lib/server/repos/canvas';
import { OPENROUTER_UPSCALE_MODEL, upscaleLimitsOf } from '$lib/video-models';

export enum UpscaleJobStatus {
  Running = 'running',
  Done = 'done',
  Failed = 'failed'
}

export type UpscaleJob = {
  nodeId: string;
  status: UpscaleJobStatus;
  error: string | null;
  factor: number | null;
  beforeUrl: string | null;
  afterUrl: string | null;
  canvasHref: string;
};

type JobScope = { orgId: string; projectId: string; nodeId: string };

const text = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

function statusOf(data: Record<string, unknown>): UpscaleJobStatus {
  if (data.running === true) {
    return UpscaleJobStatus.Running;
  }
  return text(data.refId) ? UpscaleJobStatus.Done : UpscaleJobStatus.Failed;
}

export async function upscalePricing(db: Db): Promise<Record<string, unknown>> {
  const { data } = await (db as unknown as { from(table: string): any })
    .from('ai_models')
    .select('pricing')
    .eq('id', OPENROUTER_UPSCALE_MODEL)
    .eq('catalogue', 'video')
    .maybeSingle();
  return ((data as { pricing?: Record<string, unknown> } | null)?.pricing ?? {}) as Record<string, unknown>;
}

export async function upscaleJob(db: Db, scope: JobScope): Promise<UpscaleJob | null> {
  const node = await findNode(db, { orgId: scope.orgId, nodeId: scope.nodeId });
  if (!node || node.projectId !== scope.projectId || !upscaleLimitsOf(text(node.data.model))) {
    return null;
  }

  const [connections, nodes] = await Promise.all([
    listConnections(db, { orgId: scope.orgId, canvasId: node.canvasId }),
    listNodes(db, { orgId: scope.orgId, canvasId: node.canvasId })
  ]);
  const sourceId = connections.find((c) => c.targetNodeId === node.id)?.sourceNodeId;
  const source = nodes.find((n) => n.id === sourceId);
  const sourceAsset = source ? (text(source.data.assetId) ?? text(source.data.refId)) : null;
  const canvasHref = `/p/${node.projectId}/c/${node.canvasId}`;
  const assetUrl = (id: string | null) => (id ? `${canvasHref}/assets/${id}` : null);
  const params = (node.data.params ?? {}) as Record<string, unknown>;
  const status = statusOf(node.data);

  return {
    nodeId: node.id,
    status,
    error: text(node.data.error),
    factor: typeof params.upscale_factor === 'number' ? params.upscale_factor : null,
    beforeUrl: assetUrl(sourceAsset),
    afterUrl: status === UpscaleJobStatus.Done ? assetUrl(text(node.data.refId)) : null,
    canvasHref
  };
}
