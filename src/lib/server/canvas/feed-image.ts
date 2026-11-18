import sharp from 'sharp';
import { z } from 'zod';
import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { findNode, type CanvasNodeRecord } from '$lib/server/repos/canvas';
import type { Asset } from '$lib/server/repos/assets';
import { listNodeProducts } from '$lib/server/repos/products';
import { listNodeSocialPosts } from '$lib/server/repos/social-posts';
import { UPLOAD_MAX_BYTES } from '$lib/canvas/upload-kind';
import { FEED_SOURCE_OF_NODE, FeedSource, feedImageSize, postImageUrl, productImageUrl } from '$lib/canvas/feed-image';
import { DropOn, OutputKind, type Drop } from '$lib/motion/move-element';
import { dropSchema, placeMedia, type FrameStore, type Moved } from '$lib/server/motion/move-element';
import { UploadError, fetchCanvasLink, importCanvasBytes, type PictureSize } from './upload';

export const feedImageAskSchema = z
  .object({ nodeId: z.string().min(1), itemId: z.string().min(1), imageIndex: z.number().int().min(0), drop: dropSchema, id: z.string().uuid().optional() })
  .strict();

type Picked = { imageUrl: string; source: Record<string, unknown> };

type Ask = { orgId: string; nodeId: string; itemId: string; imageIndex: number };

const NOT_THERE = 'That picture is not in this node';

async function pickPost(db: Db, ask: Ask): Promise<Picked | null> {
  const post = (await listNodeSocialPosts(db, ask)).find((p) => p.id === ask.itemId);
  const imageUrl = post ? postImageUrl(post, ask.imageIndex) : null;
  if (!post || !imageUrl) {
    return null;
  }
  return { imageUrl, source: { kind: FeedSource.Post, nodeId: ask.nodeId, itemId: post.id, externalId: post.externalId, imageUrl, pageUrl: post.permalink } };
}

async function pickProduct(db: Db, ask: Ask): Promise<Picked | null> {
  const product = (await listNodeProducts(db, ask)).find((p) => p.id === ask.itemId);
  const imageUrl = product ? productImageUrl(product, ask.imageIndex) : null;
  if (!product || !imageUrl) {
    return null;
  }
  return { imageUrl, source: { kind: FeedSource.Product, nodeId: ask.nodeId, itemId: product.id, externalId: product.externalId, imageUrl, pageUrl: product.url } };
}

const PICKERS: Record<FeedSource, (db: Db, ask: Ask) => Promise<Picked | null>> = {
  [FeedSource.Post]: pickPost,
  [FeedSource.Product]: pickProduct
};

async function pixelsOf(bytes: Uint8Array): Promise<PictureSize | null> {
  const meta = await sharp(bytes).metadata().catch(() => null);
  return meta?.width && meta.height ? { width: meta.width, height: meta.height } : null;
}

export type FeedImageLanding =
  | { placed: 'canvas'; node: CanvasNodeRecord; asset: Asset }
  | { placed: 'frame'; moved: Moved };

export async function importFeedImage(
  deps: { db: Db; frames: FrameStore; actor: Actor },
  ask: Ask & { projectId: string; canvasId: string; drop: Drop; id?: string }
): Promise<FeedImageLanding> {
  const feed = await findNode(deps.db, { orgId: ask.orgId, nodeId: ask.nodeId });
  const source = feed && feed.canvasId === ask.canvasId && feed.projectId === ask.projectId ? FEED_SOURCE_OF_NODE[feed.type] : undefined;
  const picked = source ? await PICKERS[source](deps.db, ask) : null;
  if (!picked) {
    throw new UploadError(400, NOT_THERE);
  }

  const link = await fetchCanvasLink({ url: picked.imageUrl, maxBytes: UPLOAD_MAX_BYTES.image });
  const pixels = await pixelsOf(link.bytes);
  const box = feedImageSize({ w: pixels?.width ?? 0, h: pixels?.height ?? 0 });
  const stored = { orgId: ask.orgId, projectId: ask.projectId, ...link, pixels: pixels ?? undefined };

  if (ask.drop.on === DropOn.Frame) {
    const { asset } = await importCanvasBytes(deps.db, stored);
    const moved = await placeMedia(deps.frames, { kind: OutputKind.Image, assetId: asset.id, name: link.fileName, width: pixels?.width ?? null, height: pixels?.height ?? null }, ask.drop);
    return { placed: 'frame', moved };
  }

  const place = { canvasId: ask.canvasId, x: ask.drop.x - box.w / 2, y: ask.drop.y - box.h / 2, nodeId: ask.id, box: { width: box.w, height: box.h }, actor: deps.actor, extra: { source: picked.source } };
  const { asset, node } = await importCanvasBytes(deps.db, { ...stored, place });
  return { placed: 'canvas', node, asset };
}
