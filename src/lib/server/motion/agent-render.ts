import type { Db } from '$lib/server/db/client';
import { findNode } from '$lib/server/repos/canvas';
import { findProjectById } from '$lib/server/repos/projects';
import { findAsset } from '$lib/server/repos/assets';
import { runsByIds, type NodeRun } from '$lib/server/repos/node-runs';
import { CANVAS_ASSET_BUCKET } from '$lib/server/repos/asset-storage';
import type { Actor } from '$lib/server/repos/actor';
import { motionEditorPath, motionOf } from '$lib/canvas/motion-node';
import { progressOf } from '$lib/motion/server-render';
import { BROWSER_RENDER_CREDITS } from '$lib/motion/render-place';
import { renderPagePath } from '$lib/motion/render-link';
import type { RenderSettings } from '$lib/motion/export-formats';
import type { RenderQuote } from '$lib/motion/render-quote';
import { headOrNew } from './editor';
import { createRenderLink, isBrowserRender } from './render-link';
import { isRenderRun } from './render-run';
import { startFarmRender } from './render-start';

export enum RenderMode {
  Browser = 'browser',
  Server = 'server'
}

export enum RenderAsk {
  NotFound = 'motion_node_not_found',
  Empty = 'nothing_to_render',
  RunNotFound = 'render_not_found'
}

export type RenderAskInput = { orgId: string; userId: string; nodeId: string; mode: RenderMode; settings: RenderSettings; origin: string; actor: Actor };
export type RenderAnswer = { ok: true; body: Record<string, unknown> } | { ok: false; error: string; detail?: string };

const FILE_URL_TTL_S = 60 * 60;

const modeOf = (run: NodeRun) => (isBrowserRender(run) ? RenderMode.Browser : RenderMode.Server);

export async function requestRender(db: Db, input: RenderAskInput): Promise<RenderAnswer> {
  const record = await findNode(db, { orgId: input.orgId, nodeId: input.nodeId });
  const node = record ? motionOf(record) : null;
  const project = record ? await findProjectById(db, { orgId: input.orgId, projectId: record.projectId }) : null;
  if (!record || !node || !project) {
    return { ok: false, error: RenderAsk.NotFound };
  }
  const head = await headOrNew(db, { orgId: input.orgId, nodeId: input.nodeId }, node);
  if (head.version === 0) {
    return { ok: false, error: RenderAsk.Empty };
  }

  if (input.mode === RenderMode.Browser) {
    const link = await createRenderLink(db, { orgId: input.orgId, nodeId: input.nodeId, version: head.version, actor: input.actor });
    return { ok: true, body: { mode: RenderMode.Browser, run_id: link.runId, render_url: `${input.origin}${renderPagePath(link.token)}`, expires_at: link.expiresAt, revision: head.version, credits: BROWSER_RENDER_CREDITS } };
  }

  const editorUrl = motionEditorPath({ projectId: record.projectId, canvasId: record.canvasId, nodeId: record.id });
  const started = await startFarmRender(db, { orgId: input.orgId, nodeId: input.nodeId, projectId: record.projectId, canvasId: record.canvasId, userId: input.userId, brandId: project.brandId, editorUrl, head, settings: input.settings });
  if (!started.ok) {
    return { ok: false, error: started.error, detail: started.detail };
  }
  return { ok: true, body: { mode: RenderMode.Server, run_id: started.runId, revision: head.version, credits: started.quote.credits } };
}

async function fileUrl(db: Db, orgId: string, assetId: string | null): Promise<string | null> {
  const asset = assetId ? await findAsset(db, { orgId, assetId }) : null;
  if (!asset?.url) {
    return null;
  }
  const { data } = await db.storage.from(CANVAS_ASSET_BUCKET).createSignedUrl(asset.url, FILE_URL_TTL_S);
  return data?.signedUrl ?? null;
}

export async function renderState(db: Db, input: { orgId: string; runId: string }): Promise<RenderAnswer> {
  const [run] = await runsByIds(db, { ids: [input.runId] });
  if (!run || run.orgId !== input.orgId || !(isBrowserRender(run) || isRenderRun(run))) {
    return { ok: false, error: RenderAsk.RunNotFound };
  }
  const quote = run.params.quote as Partial<RenderQuote> | undefined;
  return {
    ok: true,
    body: {
      run_id: run.id,
      node_id: run.nodeId,
      mode: modeOf(run),
      status: run.status,
      revision: Number(run.params.revision ?? 0) || null,
      progress: progressOf(run.params),
      asset_id: run.outputAssetId,
      file_url: run.status === 'done' ? await fileUrl(db, run.orgId, run.outputAssetId) : null,
      credits: isBrowserRender(run) ? BROWSER_RENDER_CREDITS : (quote?.credits ?? null),
      error: run.error,
      started_at: run.startedAt,
      finished_at: run.finishedAt
    }
  };
}
