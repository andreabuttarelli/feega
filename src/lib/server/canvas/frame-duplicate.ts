import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { findAssets } from '$lib/server/repos/assets';
import { findProjectById } from '$lib/server/repos/projects';
import { namedAssets, type AssetSigner } from '$lib/server/motion/editor';
import { savedMotion } from '$lib/server/motion/agent-embed';
import { RemixError, copyAssetFiles, landMotionDoc, type RemixPorts, type Remixed } from '$lib/server/gallery/remix';
import { swapAssetIds, type GalleryAsset } from '$lib/gallery/model';
import { findSharedCanvas } from './canvas-share';
import type { IsPublished } from './frame-share';

export type DuplicatePorts = RemixPorts & { source: Db; target: Db; sign: AssetSigner; isPublished: IsPublished };

export type DuplicateInput = { token: string; frameId: string; orgId: string; userId: string; actor: Actor; projectId: string; canvasId: string | null };

const COPY_SUMMARY = 'Copy of shared frame';
const UNTITLED_COPY = 'Untitled';

const notFound = (): Remixed => ({ ok: false, error: RemixError.NotFound, message: 'This link is no longer shared.' });

export async function duplicateSharedFrame(ports: DuplicatePorts, input: DuplicateInput): Promise<Remixed> {
  const canvas = await findSharedCanvas(ports.source, input.token);
  const saved = canvas ? await savedMotion(ports.source, { orgId: canvas.org_id, nodeId: input.frameId }) : null;
  if (!canvas || !saved || saved.record.canvasId !== canvas.id || saved.version === 0 || !(await ports.isPublished(input.frameId))) {
    return notFound();
  }

  const project = await findProjectById(ports.target, { orgId: input.orgId, projectId: input.projectId });
  if (!project) {
    return { ok: false, error: RemixError.ProjectNotFound, message: 'No project with that id in your workspace.' };
  }

  const rows = await findAssets(ports.source, { orgId: canvas.org_id, assetIds: saved.doc.assets.map((a) => a.id) });
  const shareable = [...rows.values()].filter((asset) => !asset.uncensored).map((asset) => asset.id);
  const signed = await namedAssets({ db: ports.source, orgId: canvas.org_id, projectId: canvas.project_id, canvasId: canvas.id, sign: ports.sign }, shareable);
  const files = signed.flatMap((a): GalleryAsset[] => (a.url ? [{ id: a.id, kind: a.kind, name: a.label, url: a.url }] : []));

  const ids = await copyAssetFiles(ports.target, { download: ports.download }, { orgId: input.orgId, projectId: project.id }, files);
  const title = saved.record.displayName ?? UNTITLED_COPY;
  const landed = await landMotionDoc(ports.target, { ...input, projectId: project.id, title, doc: swapAssetIds(saved.doc, ids), summary: COPY_SUMMARY });
  return landed.ok ? { ok: true, start: landed.start, editorPath: landed.editorPath, title } : landed;
}
