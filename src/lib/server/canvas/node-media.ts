import type { Db } from '$lib/server/db/client';
import { findAssets, type Asset, type AssetType } from '$lib/server/repos/assets';
import { findNode } from '$lib/server/repos/canvas';
import { findRunOutputs } from '$lib/server/repos/node-runs';
import { BUCKET_BY_SOURCE, SIGNED_URL_TTL_S, signStoredFile, signStoredPreview } from '$lib/server/repos/asset-storage';

const PREVIEWABLE: Record<AssetType, boolean> = {
  image: true,
  video: false,
  text: false,
  iframe: false,
  document: false,
  audio: false,
  model3d: false
};

export const NODE_ASSET_FIELDS = ['refId', 'assetId'] as const;

export type MediaRequest = { orgId: string; nodeIds: string[]; runIds: string[]; assetIds: string[] };

export type MediaItem = {
  assetId: string;
  nodeId: string | null;
  runId: string | null;
  type: AssetType;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  durationS: number | null;
  bytes: number | null;
  fullUrl: string | null;
  previewUrl: string | null;
  text: string | null;
};

type Wanted = { requested: string; assetId: string; nodeId: string | null; runId: string | null };

function nodeAssetId(data: Record<string, unknown>): string | null {
  const field = NODE_ASSET_FIELDS.find((key) => typeof data[key] === 'string' && data[key]);
  return field ? (data[field] as string) : null;
}

async function nodesWanted(db: Db, orgId: string, nodeIds: string[]): Promise<Wanted[]> {
  const nodes = await Promise.all(nodeIds.map((nodeId) => findNode(db, { orgId, nodeId })));

  return nodeIds.flatMap((requested, i) => {
    const assetId = nodes[i] ? nodeAssetId(nodes[i].data) : null;
    return assetId ? [{ requested, assetId, nodeId: requested, runId: null }] : [];
  });
}

async function runsWanted(db: Db, orgId: string, runIds: string[]): Promise<Wanted[]> {
  const runs = await findRunOutputs(db, { orgId, runIds });

  return runs.flatMap((run) =>
    run.outputAssetId ? [{ requested: run.id, assetId: run.outputAssetId, nodeId: run.nodeId, runId: run.id }] : []
  );
}

async function signed(serviceDb: Db, asset: Asset): Promise<Pick<MediaItem, 'fullUrl' | 'previewUrl'>> {
  if (!asset.url) {
    return { fullUrl: null, previewUrl: null };
  }

  const bucket = BUCKET_BY_SOURCE[asset.source ?? 'upload'];
  const [fullUrl, previewUrl] = await Promise.all([
    signStoredFile(serviceDb, bucket, asset.url, SIGNED_URL_TTL_S.userLink),
    PREVIEWABLE[asset.type] ? signStoredPreview(serviceDb, bucket, asset.url, SIGNED_URL_TTL_S.agentPreview) : null
  ]);
  return { fullUrl, previewUrl };
}

async function toItem(serviceDb: Db, want: Wanted, asset: Asset): Promise<MediaItem> {
  return {
    assetId: asset.id,
    nodeId: want.nodeId ?? asset.sourceNodeId,
    runId: want.runId,
    type: asset.type,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    durationS: asset.durationS,
    bytes: asset.bytes,
    text: asset.content,
    ...(await signed(serviceDb, asset))
  };
}

export async function loadMedia(
  db: Db,
  serviceDb: Db,
  input: MediaRequest
): Promise<{ items: MediaItem[]; missing: string[] }> {
  const [fromNodes, fromRuns] = await Promise.all([
    nodesWanted(db, input.orgId, input.nodeIds),
    runsWanted(db, input.orgId, input.runIds)
  ]);
  const direct = input.assetIds.map((id) => ({ requested: id, assetId: id, nodeId: null, runId: null }));
  const wanted: Wanted[] = [...fromNodes, ...fromRuns, ...direct];

  const assets = await findAssets(db, { orgId: input.orgId, assetIds: [...new Set(wanted.map((w) => w.assetId))] });
  const found = wanted.filter((w) => assets.has(w.assetId));
  const items = await Promise.all(found.map((w) => toItem(serviceDb, w, assets.get(w.assetId)!)));

  const resolved = new Set(found.map((w) => w.requested));
  const requested = [...input.nodeIds, ...input.runIds, ...input.assetIds];
  return { items, missing: requested.filter((id) => !resolved.has(id)) };
}
