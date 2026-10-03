import type { Db } from '$lib/server/db/client';
import { listProjectAssets, type Asset } from '$lib/server/repos/assets';
import { findBrandLook } from '$lib/server/repos/brands';
import { DataCheck, findNode, patchNodeData, type CanvasNodeRecord } from '$lib/server/repos/canvas';
import { appendRevision, readHead, RevisionOutcome, type MotionHead, type RevisionWrite } from '$lib/server/repos/motion-revisions';
import type { Actor } from '$lib/server/repos/actor';
import { createAssetSigningDb, signAssetPaths } from '$lib/server/canvas/sign-media';
import { motionOf, type MotionNode } from '$lib/canvas/motion-node';
import { formatOf, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { AssetKind } from '$lib/motion/components';
import { FEEGA_TOKENS, brandTokens, paletteFrom, type BrandTokens } from '$lib/motion/brand';

export type MotionAsset = { id: string; kind: AssetKind; label: string; previewUrl: string; url: string | null; seconds?: number | null };

export type MotionScope = { db: Db; orgId: string; projectId: string; canvasId: string; nodeId: string };

const MOTION_ASSET_KINDS: Record<string, AssetKind | undefined> = {
  image: AssetKind.Image,
  video: AssetKind.Video,
  audio: AssetKind.Audio,
  model3d: AssetKind.Model3d
};

const ASSET_LIMIT = 200;

export type NodePlace = { canvasId: string } | { projectId: string };

function inPlace(record: CanvasNodeRecord, place: NodePlace): boolean {
  return 'canvasId' in place ? record.canvasId === place.canvasId : record.projectId === place.projectId;
}

export async function findMotionNode(db: Db, scope: { orgId: string; nodeId: string; place: NodePlace }): Promise<{ record: CanvasNodeRecord; node: MotionNode } | null> {
  const record = await findNode(db, { orgId: scope.orgId, nodeId: scope.nodeId });
  const node = record && inPlace(record, scope.place) ? motionOf(record) : null;
  return record && node ? { record, node } : null;
}

export async function headOrNew(db: Db, scope: { orgId: string; nodeId: string }, node: MotionNode): Promise<MotionHead> {
  return (await readHead(db, scope)) ?? { version: 0, doc: newMotionDoc(node.format), summary: null, actorKind: 'system' };
}

export async function motionTokens(db: Db, input: { orgId: string; brandId: string | null }): Promise<BrandTokens> {
  const brand = input.brandId ? await findBrandLook(db, { orgId: input.orgId, brandId: input.brandId }) : null;
  if (!brand) {
    return FEEGA_TOKENS;
  }
  return brandTokens({ name: brand.name, palette: paletteFrom(brand.content), logoUrl: brand.logoUrl });
}

function assetLabel(asset: Asset, kind: AssetKind): string {
  return `${kind} · ${asset.createdAt.slice(0, 10)} · ${asset.id.slice(0, 6)}`;
}

export async function motionAssets(scope: MotionScope): Promise<MotionAsset[]> {
  const all = await listProjectAssets(scope.db, { orgId: scope.orgId, projectId: scope.projectId });
  const usable = all.filter((a) => MOTION_ASSET_KINDS[a.type] && a.url).slice(0, ASSET_LIMIT);

  const signed = await signAssetPaths(scope.db, createAssetSigningDb(), {
    generated: usable.filter((a) => a.source === 'generated').map((a) => a.url ?? ''),
    uploaded: usable.filter((a) => a.source !== 'generated' && !/^https?:\/\//.test(a.url ?? '')).map((a) => a.url ?? '')
  });

  return usable.map((asset) => {
    const kind = MOTION_ASSET_KINDS[asset.type] as AssetKind;
    const path = asset.url ?? '';
    return {
      id: asset.id,
      kind,
      label: assetLabel(asset, kind),
      previewUrl: `/p/${scope.projectId}/c/${scope.canvasId}/assets/${asset.id}`,
      seconds: asset.durationS,
      url: /^https?:\/\//.test(path) ? path : (signed.get(path) ?? null)
    };
  });
}

export function assetUrls(assets: MotionAsset[]): Record<string, string> {
  return Object.fromEntries(assets.filter((a) => a.url).map((a) => [a.id, a.url as string]));
}

export async function saveMotionDoc(
  db: Db,
  input: { orgId: string; nodeId: string; expectedVersion: number; doc: unknown; actor: Actor; summary?: string | null }
): Promise<RevisionWrite> {
  const write = await appendRevision(db, input);
  if (write.outcome !== RevisionOutcome.Written) {
    return write;
  }

  await patchNodeData(db, {
    orgId: input.orgId,
    nodeId: input.nodeId,
    patch: { docHeadRevision: write.head.version, format: formatOf(write.head.doc as MotionDoc) },
    check: DataCheck.Schema,
    actor: input.actor
  });
  return write;
}
