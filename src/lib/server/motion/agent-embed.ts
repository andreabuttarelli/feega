import type { Db } from '$lib/server/db/client';
import { findNode, type CanvasNodeRecord } from '$lib/server/repos/canvas';
import { findProjectById, type Project } from '$lib/server/repos/projects';
import { motionOf } from '$lib/canvas/motion-node';
import { embedSnippet, embedUrl, interactiveBundle, BUNDLE_FILE } from '$lib/motion/interactive/bundle';
import type { MotionDoc } from '$lib/motion/doc';
import { assetUrls, headOrNew, motionAssets, motionTokens, type AssetSigner } from './editor';
import { embedPublished, isRefused, publishEmbed, removeEmbed } from './embed';

export enum EmbedFailure {
  NotFound = 'motion_node_not_found',
  Empty = 'nothing_to_publish',
  Refused = 'refused',
  Storage = 'storage_failed'
}

export type EmbedAnswer = { ok: true; body: Record<string, unknown> } | { ok: false; failure: EmbedFailure; body: Record<string, unknown> };

type Saved = { record: CanvasNodeRecord; project: Project; version: number; doc: MotionDoc };
type Scope = { orgId: string; nodeId: string };
type PublishScope = Scope & { sign?: AssetSigner };

const fetchBlob = (url: string) => fetch(url).then((r) => r.blob());

const failed = (failure: EmbedFailure, body: Record<string, unknown> = {}): EmbedAnswer => ({ ok: false, failure, body: { error: failure, ...body } });

export async function savedMotion(db: Db, scope: Scope): Promise<Saved | null> {
  const record = await findNode(db, scope);
  const node = record ? motionOf(record) : null;
  const project = record && node ? await findProjectById(db, { orgId: scope.orgId, projectId: record.projectId }) : null;
  if (!record || !node || !project) {
    return null;
  }
  const head = await headOrNew(db, scope, node);
  return { record, project, version: head.version, doc: head.doc };
}

async function bundleInput(db: Db, scope: PublishScope, saved: Saved) {
  const assets = await motionAssets({ db, orgId: scope.orgId, projectId: saved.project.id, canvasId: saved.record.canvasId, sign: scope.sign });
  const tokens = await motionTokens(db, { orgId: scope.orgId, brandId: saved.project.brandId });
  return { doc: saved.doc, tokens, assetUrls: assetUrls(assets), title: saved.record.displayName ?? 'feega', fetchBlob };
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
    return { ok: true, body: { published: true, url: published.url, snippet: published.snippet, revision: saved.version } };
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
  return { ok: true, body: { published: await embedPublished(db, scope.nodeId), url, snippet: embedSnippet(saved.doc, url), revision: saved.version } };
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
  const bundle = await interactiveBundle(await bundleInput(db, scope, saved));
  return { ok: true, html: bundle.html, filename: BUNDLE_FILE };
}
