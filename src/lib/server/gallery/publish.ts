import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { findNode } from '$lib/server/repos/canvas';
import { readHead } from '$lib/server/repos/motion-revisions';
import { findProjectById } from '$lib/server/repos/projects';
import { listProjectAssets, type Asset } from '$lib/server/repos/assets';
import { insertGalleryItem, releaseGalleryItem, remixOrigin, withdrawGalleryItem, type GalleryRelease } from '$lib/server/repos/gallery';
import { assetsById, type AssetSigner } from '$lib/server/motion/editor';
import { ReferenceMedium, type Reference } from '$lib/server/moderation/people';
import type { ScreenOutcome } from '$lib/server/moderation/screen';
import { motionOf } from '$lib/canvas/motion-node';
import { everyClip, type MotionDoc } from '$lib/motion/doc';
import { factsOf, swapAssetIds, type GalleryAsset, type PublishMeta } from '$lib/gallery/model';
import { publishRefusal } from '$lib/gallery/refusals';
import { downloadFile, publishFile, REMIX_FOLDER, removeGalleryFiles, type FileBytes } from './files';

export type GalleryModeration = {
  text: (texts: string[]) => Promise<ScreenOutcome>;
  media: (references: Reference[]) => Promise<ScreenOutcome>;
};

export type PublishPorts = {
  moderation: GalleryModeration;
  download?: (url: string) => Promise<FileBytes>;
  sign?: AssetSigner;
};

export type PublishInput = { orgId: string; userId: string; authorName: string; actor: Actor; nodeId: string; meta: PublishMeta };

export enum PublishError {
  NotFound = 'node_not_found',
  Moderated = 'moderated',
  Refused = 'refused',
  MissingAsset = 'missing_asset'
}

export type Published = { ok: true; id: string } | { ok: false; error: PublishError | string; message: string };

type Source = { doc: MotionDoc; projectId: string; canvasId: string; posterAssetId: string | null; renderAssetId: string | null };

const MEDIA_OF: Readonly<Record<string, ReferenceMedium | undefined>> = { image: ReferenceMedium.Image, video: ReferenceMedium.Video };

const fail = (error: PublishError | string, message: string): Published => ({ ok: false, error, message });

const isSiteMaterial = (asset: Asset) => asset.source === 'imported' && !(asset.url ?? '').includes(`/${REMIX_FOLDER}`);

function docTexts(doc: MotionDoc): string[] {
  return everyClip(doc).flatMap((c) => (typeof c.props.text === 'string' && c.props.text.trim() ? [c.props.text] : []));
}

async function sourceOf(db: Db, input: { orgId: string; nodeId: string }): Promise<Source | null> {
  const record = await findNode(db, input);
  const node = record ? motionOf(record) : null;
  if (!record || !node) {
    return null;
  }
  const head = await readHead(db, input);
  return head ? { doc: head.doc, projectId: record.projectId, canvasId: record.canvasId, posterAssetId: node.posterAssetId, renderAssetId: node.lastRenderAssetId } : null;
}

async function release(db: Db, ports: PublishPorts, input: { itemId: string; source: Source; urls: Record<string, string> }): Promise<GalleryRelease> {
  const download = ports.download ?? downloadFile;
  const copy = async (assetId: string, name: string) => publishFile(db, input.itemId, name, await download(input.urls[assetId]));

  const ids: Record<string, string> = {};
  const assets: GalleryAsset[] = [];
  for (const ref of input.source.doc.assets) {
    const id = crypto.randomUUID();
    ids[ref.id] = id;
    assets.push({ id, kind: ref.kind, name: ref.name, url: await copy(ref.id, id) });
  }

  const { posterAssetId, renderAssetId } = input.source;
  return {
    doc: swapAssetIds(input.source.doc, ids),
    assets,
    posterUrl: posterAssetId && input.urls[posterAssetId] ? await copy(posterAssetId, 'poster') : null,
    previewUrl: renderAssetId && input.urls[renderAssetId] ? await copy(renderAssetId, 'preview') : null
  };
}

export async function publishToGallery(db: Db, ports: PublishPorts, input: PublishInput): Promise<Published> {
  const source = await sourceOf(db, input);
  if (!source) {
    return fail(PublishError.NotFound, 'No motion video with that id in your workspace.');
  }

  const [project, projectAssets] = await Promise.all([
    findProjectById(db, { orgId: input.orgId, projectId: source.projectId }),
    listProjectAssets(db, { orgId: input.orgId, projectId: source.projectId })
  ]);
  if (!project) {
    return fail(PublishError.NotFound, 'No motion video with that id in your workspace.');
  }

  const refused = publishRefusal({ mode: project.mode, hasBrand: project.brandId !== null, doc: source.doc, siteAssetIds: new Set(projectAssets.filter(isSiteMaterial).map((a) => a.id)) });
  if (refused) {
    return fail(refused.refusal, refused.message);
  }

  const wanted = [...source.doc.assets.map((a) => a.id), source.posterAssetId, source.renderAssetId].filter((id): id is string => Boolean(id));
  const urls = wanted.length ? await assetsById({ db, orgId: input.orgId, projectId: source.projectId, canvasId: source.canvasId, sign: ports.sign }, wanted) : {};
  const missing = source.doc.assets.find((a) => !urls[a.id]);
  if (missing) {
    return fail(PublishError.MissingAsset, `The file of ${missing.name || missing.id} is gone: remove it from the video first.`);
  }

  const { meta } = input;
  const text = await ports.moderation.text([meta.title, meta.description, meta.tags.join(', '), ...docTexts(source.doc)]);
  if (!text.ok) {
    return fail(PublishError.Moderated, text.error);
  }
  const kinds = new Map(projectAssets.map((a) => [a.id, a.type]));
  const references = wanted.flatMap((id) => {
    const medium = MEDIA_OF[kinds.get(id) ?? ''];
    return medium && urls[id] ? [{ medium, url: urls[id] }] : [];
  });
  const media = await ports.moderation.media(references);
  if (!media.ok) {
    return fail(PublishError.Moderated, media.error);
  }

  const origin = await remixOrigin(db, { orgId: input.orgId, nodeId: input.nodeId });
  const itemId = await insertGalleryItem(db, {
    orgId: input.orgId,
    userId: input.userId,
    authorName: input.authorName,
    title: meta.title,
    description: meta.description,
    tags: meta.tags,
    ...factsOf(source.doc),
    doc: source.doc,
    sourceNodeId: input.nodeId,
    remixedFrom: origin?.id ?? null,
    actor: input.actor
  });

  try {
    await releaseGalleryItem(db, { orgId: input.orgId, id: itemId, release: await release(db, ports, { itemId, source, urls }) });
  } catch (error) {
    await withdrawGalleryItem(db, { orgId: input.orgId, id: itemId }).catch(() => false);
    await removeGalleryFiles(db, itemId).catch(() => undefined);
    throw error;
  }
  return { ok: true, id: itemId };
}

export async function withdrawFromGallery(db: Db, input: { orgId: string; itemId: string }): Promise<boolean> {
  const withdrawn = await withdrawGalleryItem(db, { orgId: input.orgId, id: input.itemId });
  if (withdrawn) {
    await removeGalleryFiles(db, input.itemId);
  }
  return withdrawn;
}
