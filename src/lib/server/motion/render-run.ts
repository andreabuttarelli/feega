import type { Db } from '$lib/server/db/client';
import { claimRun, completeRun, createRun, failRun, listNodeRuns, queuedRenderRuns, releaseClaim, RENDER_JOB_PREFIX, setRunParams, type NodeRun } from '$lib/server/repos/node-runs';
import { CANVAS_ASSET_BUCKET } from '$lib/server/repos/asset-storage';
import { logAiCall } from '$lib/server/ai-log';
import { sendPushToUser } from '$lib/server/web-push';
import { formatOf, type MotionDoc } from '$lib/motion/doc';
import { renderQuote, type RenderQuote } from '$lib/motion/render-quote';
import { advance, startProgress, progressOf, type RenderEvent, type RenderProgress, type RenderView } from '$lib/motion/server-render';
import { unverified } from '$lib/motion/custom/determinism';
import { exportFolder, exportPath, outputSize } from '$lib/motion/export-plan';
import { composeHtml, HYPERFRAMES_VERSION, type ComposeInput } from '$lib/motion/hyperframes/compose';
import { assetOrigins } from '$lib/motion/hyperframes/csp';
import { audioPlan } from '$lib/motion/audio-plan';
import { CREDITS_PER_USD_SUBSCRIPTION_LIST } from '$lib/credit-ladder';
import { checkTask, FarmTask, farmChunks, farmProblem, launchAssembly, launchPiece, MAX_ATTEMPTS, pieceFile, stopWorker, TaskState, type FarmJob, type TaskCheck } from './farm-render';
import { FORMAT, exportProblem, type ExportFormat, type RenderSettings } from '$lib/motion/export-formats';
import { setFrameRate } from '$lib/motion/frame-rate';
import { lengthProblem } from '$lib/motion/render-length';
import { saveExport } from './export';
import type { RenderFarm } from './render-farm';

export enum RenderRefusal {
  NotConfigured = 'rendering_not_configured',
  Unverified = 'components_unverified',
  Busy = 'render_in_progress',
  Unsupported = 'render_unsupported',
  Unavailable = 'render_unavailable'
}

export type RenderScope = { orgId: string; projectId: string; nodeId: string; userId: string; editorUrl: string; plan?: string | null };
export type RenderRequest = { version: number; doc: MotionDoc; settings: RenderSettings; job: FarmJob };
export type RenderStart = { ok: true; runId: string; quote: RenderQuote } | { ok: false; error: RenderRefusal; detail?: string };
export type RenderStorage = { host: string; limit: () => Promise<number> };
export type ReconcileOutcome = { checked: number; done: number; failed: number; pending: number };

type Piece = { worker: string; attempt: number; state: TaskState };
type Output = { width: number; height: number; seconds: number; format: ExportFormat };
type FarmProgress = { pieces: Piece[]; assembly: { attempt: number } | null };
type RenderState = { scope: RenderScope; output: Output; quote: RenderQuote; farm: FarmProgress; progress: RenderProgress };

enum Step {
  Pending = 'pending',
  Done = 'done',
  Failed = 'failed'
}

const RENDER_MODEL = `hyperframes@${HYPERFRAMES_VERSION}`;
const RECONCILE_BATCH = 10;
const DOWNLOAD_TTL_S = 2 * 60 * 60;
const CANCELLED = 'cancelled';
const TOO_LARGE = /too_large: .*/;
const JOB_FILE = 'job.json';

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

const isActive = (run: NodeRun) => isRender(run) && (run.status === 'running' || run.status === 'finishing');

export function renderView(runs: NodeRun[]): RenderView | null {
  const run = runs.filter(isRender).at(-1);
  if (!run) {
    return null;
  }
  const quote = run.params.quote as Partial<RenderQuote> | undefined;
  return { id: run.id, status: run.status, progress: progressOf(run.params), error: run.error, assetId: run.outputAssetId, credits: quote?.credits ?? null };
}

const workPath = (scope: RenderScope, runId: string, name: string) => `${exportFolder(scope)}work/${runId}/${name}`;
const outputPath = (state: RenderState, runId: string) => exportPath(state.scope, runId, FORMAT[state.output.format].ext);

async function signedUpload(db: Db, path: string): Promise<string> {
  const { data, error } = await db.storage.from(CANVAS_ASSET_BUCKET).createSignedUploadUrl(path, { upsert: true });
  if (error || !data) {
    throw new Error(`upload link failed: ${error?.message}`);
  }
  return data.signedUrl;
}

async function signedDownload(db: Db, path: string): Promise<string> {
  const { data, error } = await db.storage.from(CANVAS_ASSET_BUCKET).createSignedUrl(path, DOWNLOAD_TTL_S);
  if (error || !data) {
    throw new Error(`download link failed: ${error?.message}`);
  }
  return data.signedUrl;
}

async function storeJob(db: Db, path: string, job: FarmJob): Promise<void> {
  const { error } = await db.storage.from(CANVAS_ASSET_BUCKET).upload(path, Buffer.from(JSON.stringify(job)), { contentType: 'application/json', upsert: true });
  if (error) {
    throw new Error(`job store failed: ${error.message}`);
  }
}

async function loadJob(db: Db, path: string): Promise<FarmJob> {
  const { data, error } = await db.storage.from(CANVAS_ASSET_BUCKET).download(path);
  if (error || !data) {
    throw new Error(`job load failed: ${error?.message}`);
  }
  return JSON.parse(await data.text()) as FarmJob;
}

async function pieceLinks(db: Db, storage: RenderStorage, scope: RenderScope, runId: string, job: FarmJob, index: number) {
  const upload = index === 0 ? null : await signedUpload(db, workPath(scope, runId, pieceFile(job, index)));
  return { upload, storageHost: storage.host, maxBytes: await storage.limit() };
}

function stateOf(run: NodeRun): RenderState {
  return run.params as unknown as RenderState;
}

async function saveState(db: Db, run: NodeRun, state: RenderState, event?: RenderEvent): Promise<RenderState> {
  const next = event ? { ...state, progress: advance(state.progress, event) } : state;
  await setRunParams(db, { orgId: run.orgId, runId: run.id, params: { ...run.params, ...next } });
  return next;
}

async function cleanUp(db: Db, farm: RenderFarm, run: NodeRun, state: RenderState, job: FarmJob | null): Promise<void> {
  await Promise.allSettled(state.farm.pieces.map((p) => stopWorker(farm, p.worker)));
  const pieces = job ? state.farm.pieces.map((_, i) => workPath(state.scope, run.id, pieceFile(job, i))).slice(1) : [];
  await db.storage.from(CANVAS_ASSET_BUCKET).remove([workPath(state.scope, run.id, JOB_FILE), ...pieces]).catch(() => {});
}

async function fail(db: Db, farm: RenderFarm, run: NodeRun, state: RenderState, error: string, job: FarmJob | null): Promise<Step> {
  await failRun(db, { orgId: run.orgId, runId: run.id, error });
  await saveState(db, run, state, { kind: 'failed' });
  await cleanUp(db, farm, run, state, job);
  return Step.Failed;
}

export async function startRender(db: Db, farm: RenderFarm | null, scope: RenderScope, req: RenderRequest, storage: RenderStorage): Promise<RenderStart> {
  if (!farm) {
    return { ok: false, error: RenderRefusal.NotConfigured };
  }
  if (unverified(req.doc).length) {
    return { ok: false, error: RenderRefusal.Unverified };
  }

  const runs = await listNodeRuns(db, { orgId: scope.orgId, nodeId: scope.nodeId });
  if (runs.some(isActive)) {
    return { ok: false, error: RenderRefusal.Busy };
  }

  const problem = lengthProblem(req.doc.durationInFrames / req.doc.fps, scope.plan ?? null) ?? exportProblem(req.doc, req.settings) ?? farmProblem(req.job);
  if (problem) {
    return { ok: false, error: RenderRefusal.Unsupported, detail: problem };
  }

  const quote = renderQuote(req.doc, req.settings.resolution);
  const count = farmChunks(req.job).count;
  const output: Output = { width: req.job.width, height: req.job.height, seconds: req.doc.durationInFrames / req.doc.fps, format: req.settings.format };
  const run = await createRun(db, {
    orgId: scope.orgId,
    nodeId: scope.nodeId,
    prompt: `render v${req.version}`,
    model: RENDER_MODEL,
    params: { revision: req.version, format: formatOf(req.doc), settings: req.settings, quote, scope, output, farm: { pieces: [], assembly: null }, progress: startProgress(req.doc.durationInFrames, count) },
    actorKind: 'user',
    actorId: scope.userId,
    externalJobId: `${RENDER_JOB_PREFIX}${req.version}`
  });

  const state = stateOf(run);
  const launched = await Promise.allSettled([
    storeJob(db, workPath(scope, run.id, JOB_FILE), req.job),
    ...Array.from({ length: count }, async (_, i) => launchPiece(farm, req.job, i, await pieceLinks(db, storage, scope, run.id, req.job, i)))
  ]);
  const pieces = launched.slice(1).flatMap((l) => (l.status === 'fulfilled' ? [{ worker: l.value as string, attempt: 1, state: TaskState.Running }] : []));
  const refused = launched.find((l): l is PromiseRejectedResult => l.status === 'rejected');

  if (refused) {
    const detail = refused.reason instanceof Error ? refused.reason.message : String(refused.reason);
    await fail(db, farm, run, { ...state, farm: { pieces, assembly: null } }, detail, req.job);
    return { ok: false, error: RenderRefusal.Unavailable, detail };
  }

  await saveState(db, run, { ...state, farm: { pieces, assembly: null } }, { kind: 'started' });
  return { ok: true, runId: run.id, quote };
}

async function retryPiece(db: Db, farm: RenderFarm, storage: RenderStorage, run: NodeRun, job: FarmJob, piece: Piece, index: number): Promise<Piece> {
  await Promise.allSettled([stopWorker(farm, piece.worker)]);
  const worker = await launchPiece(farm, job, index, await pieceLinks(db, storage, stateOf(run).scope, run.id, job, index));
  return { worker, attempt: piece.attempt + 1, state: TaskState.Running };
}

async function startAssembly(db: Db, farm: RenderFarm, storage: RenderStorage, run: NodeRun, state: RenderState, job: FarmJob, attempt: number): Promise<Step> {
  const others = state.farm.pieces.slice(1).map((_, k) => signedDownload(db, workPath(state.scope, run.id, pieceFile(job, k + 1))));
  const links = { pieces: await Promise.all(others), output: await signedUpload(db, outputPath(state, run.id)), maxBytes: await storage.limit() };
  await launchAssembly(farm, state.farm.pieces[0].worker, job, links);
  await saveState(db, run, { ...state, farm: { ...state.farm, assembly: { attempt } } }, { kind: 'assembling' });
  return Step.Pending;
}

async function advancePieces(db: Db, farm: RenderFarm, storage: RenderStorage, run: NodeRun, state: RenderState, job: FarmJob): Promise<Step> {
  const pending = (p: Piece): Promise<TaskCheck> => (p.state === TaskState.Done ? Promise.resolve({ state: TaskState.Done, error: null }) : checkTask(farm, p.worker, FarmTask.Piece));
  const checks = await Promise.all(state.farm.pieces.map(pending));

  const hopeless = (c: TaskCheck, i: number) => c.state === TaskState.Failed && (state.farm.pieces[i].attempt >= MAX_ATTEMPTS || TOO_LARGE.test(c.error ?? ''));
  const spent = checks.findIndex(hopeless);
  if (spent >= 0) {
    const error = checks[spent].error ?? 'render failed';
    return fail(db, farm, run, state, error.match(TOO_LARGE)?.[0] ?? error, job);
  }

  const landed = state.farm.pieces.filter((p, i) => i > 0 && p.state !== TaskState.Done && checks[i].state === TaskState.Done);
  await Promise.allSettled(landed.map((p) => stopWorker(farm, p.worker)));

  const pieces = await Promise.all(
    state.farm.pieces.map((p, i) => (checks[i].state === TaskState.Failed ? retryPiece(db, farm, storage, run, job, p, i) : Promise.resolve({ ...p, state: checks[i].state })))
  );
  const fresh = state.farm.pieces.filter((p, i) => p.state !== TaskState.Done && pieces[i].state === TaskState.Done).length;
  const progress = { ...state.progress, chunksDone: Math.min(state.progress.chunks, state.progress.chunksDone + fresh) };
  const next = await saveState(db, run, { ...state, progress, farm: { ...state.farm, pieces } });

  if (pieces.every((p) => p.state === TaskState.Done)) {
    return startAssembly(db, farm, storage, run, next, job, 1);
  }
  return Step.Pending;
}

function charge(scope: RenderScope, quote: RenderQuote, ms: number): number {
  const usd = quote.credits / CREDITS_PER_USD_SUBSCRIPTION_LIST;
  logAiCall({ label: 'motion_render', provider: 'vercel-sandbox', model: RENDER_MODEL, flatCostUsd: usd, ms, ok: true, orgId: scope.orgId, projectId: scope.projectId, userId: scope.userId, actorKind: 'user', actorId: scope.userId });
  return usd;
}

async function finish(db: Db, farm: RenderFarm, run: NodeRun, state: RenderState, job: FarmJob): Promise<Step> {
  const saving = await saveState(db, run, state, { kind: 'saving' });
  const { scope, output } = state;
  const saved = await saveExport(db, { orgId: scope.orgId, projectId: scope.projectId, nodeId: scope.nodeId, actor: { kind: 'user', id: scope.userId }, path: outputPath(state, run.id), ...output });
  if (!saved.ok) {
    return fail(db, farm, run, saving, saved.error, job);
  }

  const costUsd = charge(scope, state.quote, Date.now() - new Date(run.startedAt).getTime());
  await completeRun(db, { orgId: run.orgId, runId: run.id, assetId: saved.assetId, costUsd });
  await saveState(db, run, saving, { kind: 'done' });
  await cleanUp(db, farm, run, saving, job);
  await sendPushToUser(db as never, scope.userId, { title: 'feega', body: 'Your video is ready', url: scope.editorUrl, tag: `motion-render-${run.id}`, skipIfFocused: true }).catch(() => {});
  return Step.Done;
}

async function advanceAssembly(db: Db, farm: RenderFarm, storage: RenderStorage, run: NodeRun, state: RenderState, job: FarmJob, attempt: number): Promise<Step> {
  const check = await checkTask(farm, state.farm.pieces[0].worker, FarmTask.Assembly);
  if (check.state === TaskState.Running) {
    return Step.Pending;
  }
  if (check.state === TaskState.Done) {
    return finish(db, farm, run, state, job);
  }

  const error = check.error ?? 'assemble failed';
  const tooLarge = error.match(TOO_LARGE)?.[0];
  if (tooLarge || attempt >= MAX_ATTEMPTS) {
    return fail(db, farm, run, state, tooLarge ?? error, job);
  }
  const head = await farm.attach(state.farm.pieces[0].worker);
  if (!head) {
    const pieces = state.farm.pieces.map((p, i) => (i === 0 ? { ...p, state: TaskState.Failed } : p));
    await saveState(db, run, { ...state, farm: { pieces, assembly: null } });
    return Step.Pending;
  }
  return startAssembly(db, farm, storage, run, state, job, attempt + 1);
}

async function advanceRender(db: Db, farm: RenderFarm, storage: RenderStorage, run: NodeRun): Promise<Step> {
  const state = stateOf(run);
  const job = await loadJob(db, workPath(state.scope, run.id, JOB_FILE));
  const assembly = state.farm.assembly;
  return assembly ? advanceAssembly(db, farm, storage, run, state, job, assembly.attempt) : advancePieces(db, farm, storage, run, state, job);
}

export async function reconcileRenders(db: Db, farm: RenderFarm, storage: RenderStorage): Promise<ReconcileOutcome> {
  const outcome: ReconcileOutcome = { checked: 0, done: 0, failed: 0, pending: 0 };
  for (const queued of await queuedRenderRuns(db, { limit: RECONCILE_BATCH })) {
    const claimed = await claimRun(db, { orgId: queued.orgId, runId: queued.id });
    if (!claimed) {
      continue;
    }
    outcome.checked += 1;

    const step = await advanceRender(db, farm, storage, queued).catch(async (e) => {
      console.error('[motion render] reconcile failed', queued.id, e);
      return Step.Pending;
    });
    if (step === Step.Pending) {
      await releaseClaim(db, { orgId: queued.orgId, runId: queued.id });
    }
    outcome[step] += 1;
  }
  return outcome;
}

export async function cancelRender(db: Db, farm: RenderFarm, scope: Pick<RenderScope, 'orgId' | 'nodeId'>): Promise<{ ok: boolean }> {
  const runs = await listNodeRuns(db, { orgId: scope.orgId, nodeId: scope.nodeId });
  const active = runs.filter((r) => isRender(r) && r.status === 'running').at(-1);
  if (!active || !(await claimRun(db, { orgId: active.orgId, runId: active.id }))) {
    return { ok: false };
  }
  const state = stateOf(active);
  const job = await loadJob(db, workPath(state.scope, active.id, JOB_FILE)).catch(() => null);
  await fail(db, farm, active, state, CANCELLED, job);
  return { ok: true };
}
