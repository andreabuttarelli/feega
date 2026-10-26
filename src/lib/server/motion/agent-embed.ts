import { withScenes } from '$lib/canvas/scene-sources';
import type { Db } from '$lib/server/db/client';
import { findNode, type CanvasNodeRecord } from '$lib/server/repos/canvas';
import { findProjectById, type Project } from '$lib/server/repos/projects';
import { readHead } from '$lib/server/repos/motion-revisions';
import { motionOf, type MotionNode } from '$lib/canvas/motion-node';
import { embedUrl, interactiveBundle, BUNDLE_FILE } from '$lib/motion/interactive/bundle';
import { embedSnippets } from '$lib/motion/interactive/loader';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { assetUrls, newHead, motionAssets, motionTokens, type AssetSigner } from './editor';
import { embedPublished, isRefused, publishEmbed, removeEmbed } from './embed';
import { libsOrigin } from './libs-origin';

export enum EmbedFailure {
  NotFound = 'motion_node_not_found',
  Empty = 'nothing_to_publish',
  Refused = 'refused',
  NotPublished = 'embed_not_published',
  Storage = 'storage_failed'
}

export type EmbedAnswer = { ok: true; body: Record<string, unknown> } | { ok: false; failure: EmbedFailure; body: Record<string, unknown> };

type Saved = { record: CanvasNodeRecord; node: MotionNode; project: Project; version: number; doc: MotionDoc };
type Scope = { orgId: string; nodeId: string };
type PublishScope = Scope & { sign?: AssetSigner };

const HTTP_OK = 200;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_BAD_GATEWAY = 502;

const STATUS_OF: Record<EmbedFailure, number> = {
  [EmbedFailure.NotFound]: HTTP_NOT_FOUND,
  [EmbedFailure.Empty]: HTTP_CONFLICT,
  [EmbedFailure.NotPublished]: HTTP_CONFLICT,
  [EmbedFailure.Refused]: HTTP_FORBIDDEN,
  [EmbedFailure.Storage]: HTTP_BAD_GATEWAY
};

export const embedStatus = (answer: EmbedAnswer): number => (answer.ok ? HTTP_OK : STATUS_OF[answer.failure]);

const fetchBlob = (url: string) => fetch(url).then((r) => r.blob());

const failed = (failure: EmbedFailure, body: Record<string, unknown> = {}): EmbedAnswer => ({ ok: false, failure, body: { error: failure, ...body } });

export async function savedMotionWith<T>(db: Db, scope: Scope, alongside: (record: CanvasNodeRecord) => Promise<T>): Promise<(Saved & { alongside: T }) | null> {
  const [record, head] = await Promise.all([findNode(db, scope), readHead(db, scope)]);
  const node = record ? motionOf(record) : null;
  if (!record || !node) {
    return null;
  }
  const [project, extra] = await Promise.all([findProjectById(db, { orgId: scope.orgId, projectId: record.projectId }), alongside(record)]);
  if (!project) {
    return null;
  }
  const { version, doc } = head ?? newHead(node);
  return { record, node, project, version, doc, alongside: extra };
}

export async function savedMotion(db: Db, scope: Scope): Promise<Saved | null> {
  return savedMotionWith(db, scope, async () => null);
}

async function bundleInput(db: Db, scope: PublishScope, saved: Saved) {
  const assets = await motionAssets({ db, orgId: scope.orgId, projectId: saved.project.id, canvasId: saved.record.canvasId, sign: scope.sign });
  const tokens = await motionTokens(db, { orgId: scope.orgId, brandId: saved.project.brandId });
  const sceneHead = async (nodeId: string) => {
    const head = await readHead(db, { orgId: scope.orgId, nodeId });
    return head ? { doc: head.doc, assets: {} } : null;
  };
  const { doc } = await withScenes({ doc: saved.doc, assets: {} }, sceneHead);
  return { doc, tokens, assetUrls: assetUrls(assets), title: saved.record.displayName ?? 'feega', fetchBlob };
}

export async function publishMotionEmbed(db: Db, scope: PublishScope, origin: string): Promise<EmbedAnswer> {
  const saved = await savedMotion(db, scope);
  if (!saved) {
    return failed(EmbedFailure.NotFound);
  }
  if (saved.version === 0) {
    return failed(EmbedFailure.Empty);
  }

  const published = await publishEmbed(db, { ...(await bundleInput(db, scope, saved)), nodeId: scope.nodeId, mode: saved.project.mode }, origin);
  if (published.ok) {
    return { ok: true, body: { published: true, url: published.url, ...embedSnippets(origin, scope.nodeId), revision: saved.version } };
  }
  return isRefused(published) ? failed(EmbedFailure.Refused, { refusal: published.refusal, detail: published.error }) : failed(EmbedFailure.Storage, { detail: published.error });
}

export async function unpublishMotionEmbed(db: Db, scope: Scope): Promise<EmbedAnswer> {
  if (!(await savedMotion(db, scope))) {
    return failed(EmbedFailure.NotFound);
  }
  const removed = await removeEmbed(db, scope.nodeId);
  return removed.ok ? { ok: true, body: { published: false } } : failed(EmbedFailure.Storage, { detail: removed.error });
}

export async function motionEmbedState(db: Db, scope: Scope, origin: string): Promise<EmbedAnswer> {
  const saved = await savedMotion(db, scope);
  if (!saved) {
    return failed(EmbedFailure.NotFound);
  }
  const url = embedUrl(origin, scope.nodeId);
  return { ok: true, body: { published: await embedPublished(db, scope.nodeId), url, ...embedSnippets(origin, scope.nodeId), revision: saved.version } };
}

export type MotionBundle = { ok: true; html: string; filename: string } | { ok: false; failure: EmbedFailure };

export async function motionBundle(db: Db, scope: Scope): Promise<MotionBundle> {
  const saved = await savedMotion(db, scope);
  if (!saved) {
    return { ok: false, failure: EmbedFailure.NotFound };
  }
  if (saved.version === 0) {
    return { ok: false, failure: EmbedFailure.Empty };
  }
  const bundle = await interactiveBundle({ origin: libsOrigin(), ...(await bundleInput(db, scope, saved)) });
  return { ok: true, html: bundle.html, filename: BUNDLE_FILE };
}
