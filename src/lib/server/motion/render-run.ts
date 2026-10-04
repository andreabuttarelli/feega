import type { Db } from '$lib/server/db/client';
import { claimRun, completeRun, createRun, failRun, listNodeRuns, RENDER_JOB_PREFIX, setRunParams, type NodeRun } from '$lib/server/repos/node-runs';
import { CANVAS_ASSET_BUCKET } from '$lib/server/repos/asset-storage';
import { logAiCall } from '$lib/server/ai-log';
import { sendPushToUser } from '$lib/server/web-push';
import { runInBackground } from '$lib/server/background-work';
import { formatOf, type MotionDoc } from '$lib/motion/doc';
import { renderQuote, type RenderQuote } from '$lib/motion/render-quote';
import { advance, startProgress, progressOf, type RenderEvent, type RenderProgress, type RenderView } from '$lib/motion/server-render';
import { unverified } from '$lib/motion/custom/determinism';
import { exportPath, outputSize } from '$lib/motion/export-plan';
import { composeHtml, HYPERFRAMES_VERSION, type ComposeInput } from '$lib/motion/hyperframes/compose';
import { assetOrigins } from '$lib/motion/hyperframes/csp';
import { audioPlan } from '$lib/motion/audio-plan';
import { CREDITS_PER_USD_SUBSCRIPTION_LIST } from '$lib/credit-ladder';
import { farmChunks, farmProblem, renderOnFarm, type FarmJob } from './farm-render';
import { FORMAT, exportProblem, oversize, type RenderSettings } from '$lib/motion/export-formats';
import { setFrameRate } from '$lib/motion/frame-rate';
import { lengthProblem } from '$lib/motion/render-length';
import { saveExport } from './export';
import type { RenderFarm } from './render-farm';

export enum RenderRefusal {
  NotConfigured = 'rendering_not_configured',
  Unverified = 'components_unverified',
  Busy = 'render_in_progress',
  Unsupported = 'render_unsupported'
}

export type RenderScope = { orgId: string; projectId: string; nodeId: string; userId: string; editorUrl: string; plan?: string | null };
export type RenderRequest = { version: number; doc: MotionDoc; settings: RenderSettings; job: FarmJob };
export type RenderStart = { ok: true; runId: string; quote: RenderQuote } | { ok: false; error: RenderRefusal; detail?: string };

const RENDER_MODEL = `hyperframes@${HYPERFRAMES_VERSION}`;

export function farmJob(input: ComposeInput, settings: RenderSettings): FarmJob {
  const { doc, tokens, assets } = input;
  const reachable = assetOrigins([...Object.values(assets), tokens.logoUrl ?? '']);
  const out = outputSize(doc, settings.resolution);
  return {
    html: composeHtml({ ...input, scale: out.scale }),
    width: out.width,
    height: out.height,
    fps: doc.fps,
    totalFrames: doc.durationInFrames,
    audio: audioPlan(doc, assets),
    allowHosts: reachable.map((origin) => new URL(origin).host),
    format: settings.format,
    quality: settings.quality,
    motionBlur: doc.motionBlur.enabled ? { shutterAngle: doc.motionBlur.shutterAngle, shutterPhase: doc.motionBlur.shutterPhase, samples: doc.motionBlur.samples } : null
  };
}

export function renderRequest(version: number, input: ComposeInput, settings: RenderSettings): RenderRequest {
  const paced = setFrameRate(input.doc, settings.fps);
  const doc = paced.ok ? paced.doc : input.doc;
  return { version, doc, settings, job: farmJob({ ...input, doc }, settings) };
}

function isRender(run: NodeRun): boolean {
  return Boolean(run.externalJobId?.startsWith(RENDER_JOB_PREFIX));
}

export function renderView(runs: NodeRun[]): RenderView | null {
  const run = runs.filter(isRender).at(-1);
  if (!run) {
    return null;
  }
  const quote = run.params.quote as Partial<RenderQuote> | undefined;
  return { id: run.id, status: run.status, progress: progressOf(run.params), error: run.error, assetId: run.outputAssetId, credits: quote?.credits ?? null };
}

export async function startRender(db: Db, farm: RenderFarm | null, scope: RenderScope, req: RenderRequest): Promise<RenderStart> {
  if (!farm) {
    return { ok: false, error: RenderRefusal.NotConfigured };
  }
  if (unverified(req.doc).length) {
    return { ok: false, error: RenderRefusal.Unverified };
  }

  const runs = await listNodeRuns(db, { orgId: scope.orgId, nodeId: scope.nodeId });
  if (runs.some((r) => isRender(r) && r.status === 'running')) {
    return { ok: false, error: RenderRefusal.Busy };
  }

  const problem = lengthProblem(req.doc.durationInFrames / req.doc.fps, scope.plan ?? null) ?? exportProblem(req.doc, req.settings) ?? farmProblem(req.job);
  if (problem) {
    return { ok: false, error: RenderRefusal.Unsupported, detail: problem };
  }

  const quote = renderQuote(req.doc, req.settings.resolution);
  const run = await createRun(db, {
    orgId: scope.orgId,
    nodeId: scope.nodeId,
    prompt: `render v${req.version}`,
    model: RENDER_MODEL,
    params: { revision: req.version, format: formatOf(req.doc), settings: req.settings, quote, progress: startProgress(req.doc.durationInFrames, farmChunks(req.job).count) },
    actorKind: 'user',
    actorId: scope.userId,
    externalJobId: `${RENDER_JOB_PREFIX}${req.version}`
  });

  runInBackground(() => finishRender(db, farm, scope, run, req), 'motion-render');
  return { ok: true, runId: run.id, quote };
}

function progressWriter(db: Db, run: NodeRun) {
  let progress = progressOf(run.params) as RenderProgress;
  let writes = Promise.resolve();
  return (event: RenderEvent) => {
    progress = advance(progress, event);
    const params = { ...run.params, progress };
    writes = writes.then(() => setRunParams(db, { orgId: run.orgId, runId: run.id, params })).catch(() => {});
    return writes;
  };
}

async function fail(db: Db, run: NodeRun, error: string, record: (e: RenderEvent) => Promise<void>): Promise<void> {
  await failRun(db, { orgId: run.orgId, runId: run.id, error });
  await record({ kind: 'failed' });
}

async function store(db: Db, scope: RenderScope, run: NodeRun, req: RenderRequest, bytes: Buffer) {
  const tooLarge = oversize(bytes.length, req.settings.format);
  if (tooLarge) {
    return { ok: false as const, error: tooLarge };
  }
  const spec = FORMAT[req.settings.format];
  const path = exportPath(scope, run.id, spec.ext);
  const upload = await db.storage.from(CANVAS_ASSET_BUCKET).upload(path, bytes, { contentType: spec.mime, upsert: true });
  if (upload.error) {
    return { ok: false as const, error: `store_failed: ${upload.error.message}` };
  }
  return saveExport(db, {
    orgId: scope.orgId,
    projectId: scope.projectId,
    nodeId: scope.nodeId,
    actor: { kind: 'user', id: scope.userId },
    path,
    width: req.job.width,
    height: req.job.height,
    seconds: req.doc.durationInFrames / req.doc.fps,
    format: req.settings.format
  });
}

function charge(scope: RenderScope, quote: RenderQuote, ms: number): number {
  const usd = quote.credits / CREDITS_PER_USD_SUBSCRIPTION_LIST;
  logAiCall({ label: 'motion_render', provider: 'vercel-sandbox', model: RENDER_MODEL, flatCostUsd: usd, ms, ok: true, orgId: scope.orgId, projectId: scope.projectId, userId: scope.userId, actorKind: 'user', actorId: scope.userId });
  return usd;
}

export async function finishRender(db: Db, farm: RenderFarm, scope: RenderScope, run: NodeRun, req: RenderRequest): Promise<void> {
  const started = Date.now();
  const record = progressWriter(db, run);

  let bytes: Buffer;
  try {
    bytes = await renderOnFarm(farm, req.job, (e) => void record(e));
  } catch (e) {
    await fail(db, run, e instanceof Error ? e.message : String(e), record);
    return;
  }

  const claimed = await claimRun(db, { orgId: run.orgId, runId: run.id });
  if (!claimed) {
    return;
  }

  await record({ kind: 'saving' });
  const saved = await store(db, scope, run, req, bytes);
  if (!saved.ok) {
    await fail(db, run, saved.error, record);
    return;
  }

  const costUsd = charge(scope, renderQuote(req.doc, req.settings.resolution), Date.now() - started);
  await completeRun(db, { orgId: run.orgId, runId: run.id, assetId: saved.assetId, costUsd });
  await record({ kind: 'done' });
  await sendPushToUser(db as never, scope.userId, { title: 'feega', body: 'Your video is ready', url: scope.editorUrl, tag: `motion-render-${run.id}`, skipIfFocused: true }).catch(() => {});
}
