import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { insertAsset, type AssetType } from '$lib/server/repos/assets';
import { findGalleryItem, recordRemix } from '$lib/server/repos/gallery';
import { RevisionOutcome } from '$lib/server/repos/motion-revisions';
import { saveMotionDoc } from '$lib/server/motion/editor';
import { MOTION_START_DEPS, startMotion, type MotionStart } from '$lib/server/motion/start';
import { motionEditorPath } from '$lib/canvas/motion-node';
import { composeEditorPath, draftFromDoc } from '$lib/motion/composition-draft';
import type { AssetRef, MotionDoc } from '$lib/motion/doc';
import { swapAssetIds, type GalleryAsset } from '$lib/gallery/model';
import { exposeMainFields } from '$lib/gallery/remix-fields';
import { downloadFile, isGalleryFile, storeRemixFile, type FileBytes } from './files';
import { adoptShaders, workspaceAuthor } from '$lib/server/effects/adopt';
import { adoptLayouts } from '$lib/server/layouts/adopt';

export type RemixPorts = { download?: (url: string) => Promise<FileBytes> };

export type RemixInput = { orgId: string; userId: string; actor: Actor; itemId: string; projectId: string; canvasId: string | null };

export enum RemixError {
  NotFound = 'item_not_found',
  ProjectNotFound = 'project_not_found',
  CanvasNotFound = 'canvas_not_found',
  ForeignFile = 'foreign_file',
  NotSaved = 'not_saved'
}

export type Remixed = { ok: true; start: MotionStart; editorPath: string; title: string } | { ok: false; error: RemixError; message: string };

const ASSET_TYPE: Readonly<Record<AssetRef['kind'], AssetType>> = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  model3d: 'model3d',
  font: 'document'
};

const REMIX_SUMMARY = 'Remix of';

const fail = (error: RemixError, message: string): Remixed => ({ ok: false, error, message });

export async function copyAssetFiles(db: Db, ports: RemixPorts, scope: { orgId: string; projectId: string }, assets: GalleryAsset[]): Promise<Record<string, string>> {
  const download = ports.download ?? downloadFile;
  const ids: Record<string, string> = {};
  for (const asset of assets) {
    const file = await download(asset.url);
    const path = await storeRemixFile(db, scope, file);
    const row = await insertAsset(db, { orgId: scope.orgId, projectId: scope.projectId, type: ASSET_TYPE[asset.kind], source: 'imported', url: path, mimeType: file.mime, bytes: file.bytes.length });
    ids[asset.id] = row.id;
  }
  return ids;
}

type Landing = { orgId: string; userId: string; actor: Actor; projectId: string; canvasId: string | null; title: string; doc: MotionDoc; summary: string };

export type Landed = { ok: true; start: MotionStart; editorPath: string } | { ok: false; error: RemixError; message: string };

export async function landMotionDoc(db: Db, input: Landing): Promise<Landed> {
  const start = await startMotion(db, MOTION_START_DEPS, { orgId: input.orgId, projectId: input.projectId, canvasId: input.canvasId, userId: input.userId, name: input.title, picture: input.doc });
  if (!start) {
    return fail(RemixError.CanvasNotFound, 'That canvas is not in this project.');
  }

  const workspace = { orgId: input.orgId, author: workspaceAuthor(input) };
  const doc = await adoptLayouts(db, workspace, await adoptShaders(db, workspace, exposeMainFields(input.doc)));
  const saved = await saveMotionDoc(db, { orgId: input.orgId, nodeId: start.nodeId, expectedVersion: 0, doc, actor: input.actor, summary: input.summary });
  if (saved.outcome !== RevisionOutcome.Written) {
    return fail(RemixError.NotSaved, 'The copy could not be saved.');
  }

  return { ok: true, start, editorPath: draftFromDoc(doc) ? composeEditorPath(start) : motionEditorPath(start) };
}

export async function remixGalleryItem(db: Db, ports: RemixPorts, input: RemixInput): Promise<Remixed> {
  const item = await findGalleryItem(db, input.itemId);
  if (!item) {
    return fail(RemixError.NotFound, 'This video is not in the gallery any more.');
  }

  if (item.assets.some((a) => !isGalleryFile(db, a.url, item.id))) {
    return fail(RemixError.ForeignFile, 'This gallery item points at a file outside the gallery.');
  }

  const ids = await copyAssetFiles(db, ports, { orgId: input.orgId, projectId: input.projectId }, item.assets);
  const landed = await landMotionDoc(db, { ...input, title: item.title, doc: swapAssetIds(item.doc, ids), summary: `${REMIX_SUMMARY} ${item.title}` });
  if (!landed.ok) {
    return landed;
  }

  await recordRemix(db, { orgId: input.orgId, itemId: item.id, nodeId: landed.start.nodeId, actor: input.actor });
  return { ok: true, start: landed.start, editorPath: landed.editorPath, title: item.title };
}
