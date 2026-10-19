import { isInteractive } from '$lib/motion/interactive/settings';
import type { Db } from '$lib/server/db/client';
import { listProjectAssets, type Asset, type AssetType } from '$lib/server/repos/assets';
import { findBrandLook } from '$lib/server/repos/brands';
import { DataCheck, findNode, patchNodeData, resizeNode, type CanvasNodeRecord } from '$lib/server/repos/canvas';
import { appendRevision, readHead, RevisionOutcome, type Checkpoint, type MotionHead, type RevisionWrite } from '$lib/server/repos/motion-revisions';
import type { Actor } from '$lib/server/repos/actor';
import { createAssetSigningDb, signAssetPaths } from '$lib/server/canvas/sign-media';
import { docNodeSize, motionOf, type MotionNode } from '$lib/canvas/motion-node';
import { formatOf, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { AssetKind } from '$lib/motion/components';
import { FEEGA_TOKENS, brandTokens, paletteFrom, type BrandTokens } from '$lib/motion/brand';
import { GOOGLE_FONTS } from '$lib/motion/fonts/catalogue';
import { fontsFrom } from '$lib/motion/fonts/model';

export type MotionAsset = { id: string; kind: AssetKind; label: string; previewUrl: string; url: string | null; seconds?: number | null; width?: number | null; height?: number | null };

export type MotionScope = { db: Db; orgId: string; projectId: string; canvasId: string; nodeId: string };

const MOTION_ASSET_KINDS: Record<string, AssetKind | undefined> = {
  image: AssetKind.Image,
  video: AssetKind.Video,
  audio: AssetKind.Audio,
  model3d: AssetKind.Model3d
};

const ASSET_LIMIT = 200;
const FONT_MIME = 'font/';

function kindOf(asset: Asset): AssetKind | undefined {
  return asset.type === 'document' && asset.mimeType?.startsWith(FONT_MIME) ? AssetKind.Font : MOTION_ASSET_KINDS[asset.type];
}

export type NodePlace = { canvasId: string } | { projectId: string };

function inPlace(record: CanvasNodeRecord, place: NodePlace): boolean {
  return 'canvasId' in place ? record.canvasId === place.canvasId : record.projectId === place.projectId;
}

export async function findMotionNode(db: Db, scope: { orgId: string; nodeId: string; place: NodePlace }): Promise<{ record: CanvasNodeRecord; node: MotionNode } | null> {
  const record = await findNode(db, { orgId: scope.orgId, nodeId: scope.nodeId });
  const node = record && inPlace(record, scope.place) ? motionOf(record) : null;
  return record && node ? { record, node } : null;
}

export const newHead = (node: MotionNode): MotionHead => ({ version: 0, doc: newMotionDoc(node.format), summary: null, actorKind: 'system' });

export async function headOrNew(db: Db, scope: { orgId: string; nodeId: string }, node: MotionNode): Promise<MotionHead> {
  return (await readHead(db, scope)) ?? newHead(node);
}

export async function motionTokens(db: Db, input: { orgId: string; brandId: string | null }): Promise<BrandTokens> {
  const brand = input.brandId ? await findBrandLook(db, { orgId: input.orgId, brandId: input.brandId }) : null;
  if (!brand) {
    return FEEGA_TOKENS;
  }
  return { ...brandTokens({ name: brand.name, palette: paletteFrom(brand.content), logoUrl: brand.logoUrl }), fonts: fontsFrom(brand.content, GOOGLE_FONTS) };
}

function assetLabel(asset: Asset, kind: AssetKind): string {
  return `${kind} · ${asset.createdAt.slice(0, 10)} · ${asset.id.slice(0, 6)}`;
}

export type AssetSigner = (paths: { generated: string[]; uploaded: string[] }, ttlSeconds?: number) => Promise<Map<string, string>>;
type AssetScope = Pick<MotionScope, 'db' | 'orgId' | 'projectId' | 'canvasId'> & { sign?: AssetSigner };

const memberSigner =
  (db: Db): AssetSigner =>
  (paths, ttlSeconds) =>
    signAssetPaths(db, createAssetSigningDb(), paths, ttlSeconds);

const MEDIA_TYPES = Object.keys(MOTION_ASSET_KINDS) as AssetType[];
const newestFirst = (a: Asset, b: Asset) => b.createdAt.localeCompare(a.createdAt);

export async function motionAssets(scope: AssetScope, ttlSeconds?: number): Promise<MotionAsset[]> {
  const place = { orgId: scope.orgId, projectId: scope.projectId, limit: ASSET_LIMIT };
  const [media, fonts] = await Promise.all([
    listProjectAssets(scope.db, { ...place, types: MEDIA_TYPES }),
    listProjectAssets(scope.db, { ...place, types: ['document'], mimePrefix: FONT_MIME })
  ]);
  const unique = [...new Map([...media, ...fonts].map((a) => [a.id, a])).values()];
  const usable = unique.filter((a) => kindOf(a) && a.url).sort(newestFirst).slice(0, ASSET_LIMIT);
  return signAssets(scope, usable, ttlSeconds);
}

export async function assetsById(scope: AssetScope, ids: string[]): Promise<Record<string, string>> {
  const wanted = new Set(ids);
  const all = await listProjectAssets(scope.db, { orgId: scope.orgId, projectId: scope.projectId });
  return assetUrls(await signAssets(scope, all.filter((a) => wanted.has(a.id) && kindOf(a) && a.url)));
}

async function signAssets(scope: AssetScope, usable: Asset[], ttlSeconds?: number): Promise<MotionAsset[]> {
  const sign = scope.sign ?? memberSigner(scope.db);
  const signed = await sign({
    generated: usable.filter((a) => a.source === 'generated').map((a) => a.url ?? ''),
    uploaded: usable.filter((a) => a.source !== 'generated' && !/^https?:\/\//.test(a.url ?? '')).map((a) => a.url ?? '')
  }, ttlSeconds);

  return usable.map((asset) => {
    const kind = kindOf(asset) as AssetKind;
    const path = asset.url ?? '';
    return {
      id: asset.id,
      kind,
      label: assetLabel(asset, kind),
      previewUrl: `/p/${scope.projectId}/c/${scope.canvasId}/assets/${asset.id}`,
      seconds: asset.durationS,
      width: asset.width,
      height: asset.height,
      url: /^https?:\/\//.test(path) ? path : (signed.get(path) ?? null)
    };
  });
}

export function assetUrls(assets: MotionAsset[]): Record<string, string> {
  return Object.fromEntries(assets.filter((a) => a.url).map((a) => [a.id, a.url as string]));
}

export const headPatch = (doc: MotionDoc, version: number) => ({ docHeadRevision: version, format: formatOf(doc), interactive: isInteractive(doc) });

export async function saveMotionDoc(
  db: Db,
  input: { orgId: string; nodeId: string; expectedVersion: number; doc: unknown; actor: Actor; summary?: string | null; known?: CanvasNodeRecord; checkpoint?: Checkpoint }
): Promise<RevisionWrite> {
  const write = await appendRevision(db, input);
  if (write.outcome !== RevisionOutcome.Written) {
    return write;
  }

  const patched = await patchNodeData(db, {
    orgId: input.orgId,
    nodeId: input.nodeId,
    patch: headPatch(write.head.doc as MotionDoc, write.head.version),
    check: DataCheck.Schema,
    actor: input.actor,
    known: input.known
  });
  if (patched.outcome === 'written') {
    await followDoc(db, input.orgId, patched.node, write.head.doc as MotionDoc);
  }
  return write;
}

async function followDoc(db: Db, orgId: string, record: CanvasNodeRecord, doc: MotionDoc): Promise<void> {
  const node = motionOf(record);
  const size = node ? docNodeSize({ kind: node.kind, ...record.size }, doc) : null;
  if (size) {
    await resizeNode(db, { orgId, nodeId: record.id, width: size.w, height: size.h });
  }
}
