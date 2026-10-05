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
import { checkTask, FarmTask, farmChunks, farmProblem, firstSlices, framesOf, halves, launchAssembly, launchPiece, MAX_ATTEMPTS, pieceFile, stopWorker, TaskState, WORKER_GONE, type FarmJob, type Slice, type TaskCheck } from './farm-render';
import { costSpans } from '$lib/motion/render-cost';
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
export type BatchRow = { req: RenderRequest; name: string };
export type BatchStart = { ok: true; batchId: string; rows: number; credits: number } | { ok: false; error: RenderRefusal; detail?: string };
export type BatchCell = { row: number; name: string; runId: string; status: NodeRun['status']; progress: RenderProgress | null; error: string | null; assetId: string | null };
export type BatchView = { id: string; credits: number; rows: BatchCell[] };
export type ReconcileOutcome = { checked: number; done: number; failed: number; pending: number };

type Piece = { worker: string; attempt: number; state: TaskState; slice: Slice };
type Output = { width: number; height: number; seconds: number; format: ExportFormat };
type FarmProgress = { pieces: Piece[]; assembly: { attempt: number } | null };
type BatchTag = { id: string; row: number; name: string; rows: number };
type RenderState = { scope: RenderScope; output: Output; quote: RenderQuote; farm: FarmProgress; progress: RenderProgress; batch?: BatchTag };

enum Step {
  Pending = 'pending',
  Done = 'done',
  Failed = 'failed'
}

const RENDER_MODEL = `hyperframes@${HYPERFRAMES_VERSION}`;
const RECONCILE_BATCH = 50;
export const BATCH_CONCURRENCY = 3;
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
    motionBlur: doc.motionBlur.enabled ? { shutterAngle: doc.motionBlur.shutterAngle, shutterPhase: doc.motionBlur.shutterPhase, samples: doc.motionBlur.samples } : null,
    cost: costSpans(doc, out.width * out.height)
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
  const run = runs.filter((r) => isRender(r) && !r.params.batch).at(-1);
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

async function pieceLinks(db: Db, storage: RenderStorage, scope: RenderScope, runId: string, job: FarmJob, slice: Slice) {
  const upload = slice.index === 0 ? null : await signedUpload(db, workPath(scope, runId, pieceFile(job, slice)));
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
  const pieces = job ? state.farm.pieces.filter((p) => p.slice.index > 0).map((p) => workPath(state.scope, run.id, pieceFile(job, p.slice))) : [];
  await db.storage.from(CANVAS_ASSET_BUCKET).remove([workPath(state.scope, run.id, JOB_FILE), ...pieces]).catch(() => {});
}

async function fail(db: Db, farm: RenderFarm, run: NodeRun, state: RenderState, error: string, job: FarmJob | null): Promise<Step> {
  await failRun(db, { orgId: run.orgId, runId: run.id, error });
  await saveState(db, run, state, { kind: 'failed' });
  await cleanUp(db, farm, run, state, job);
  return Step.Failed;
}

type Refusal = { error: RenderRefusal; detail?: string };

function refusal(farm: RenderFarm | null, runs: NodeRun[], plan: string | null, req: RenderRequest): Refusal | null {
  if (!farm) {
    return { error: RenderRefusal.NotConfigured };
  }
  if (unverified(req.doc).length) {
    return { error: RenderRefusal.Unverified };
  }
  if (runs.some(isActive)) {
    return { error: RenderRefusal.Busy };
  }
  const problem = lengthProblem(req.doc.durationInFrames / req.doc.fps, plan) ?? exportProblem(req.doc, req.settings) ?? farmProblem(req.job);
  return problem ? { error: RenderRefusal.Unsupported, detail: problem } : null;
}

async function enqueue(db: Db, scope: RenderScope, req: RenderRequest, extra: Record<string, unknown> = {}): Promise<NodeRun> {
  const quote = renderQuote(req.doc, req.settings.resolution);
  const count = farmChunks(req.job).count;
  const output: Output = { width: req.job.width, height: req.job.height, seconds: req.doc.durationInFrames / req.doc.fps, format: req.settings.format };
  const run = await createRun(db, {
    orgId: scope.orgId,
    nodeId: scope.nodeId,
    prompt: `render v${req.version}`,
    model: RENDER_MODEL,
    params: { revision: req.version, format: formatOf(req.doc), settings: req.settings, quote, scope, output, farm: { pieces: [], assembly: null }, progress: startProgress(req.doc.durationInFrames, count), ...extra },
    actorKind: 'user',
    actorId: scope.userId,
    externalJobId: `${RENDER_JOB_PREFIX}${req.version}`
  });
  await storeJob(db, workPath(scope, run.id, JOB_FILE), req.job);
  return run;
}

async function launch(db: Db, farm: RenderFarm, storage: RenderStorage, run: NodeRun, job: FarmJob): Promise<string | null> {
  const state = stateOf(run);
  const slices = firstSlices(job);
  const launched = await Promise.allSettled(slices.map(async (slice) => launchPiece(farm, job, slice, await pieceLinks(db, storage, state.scope, run.id, job, slice))));
  const pieces = launched.flatMap((l, i) => (l.status === 'fulfilled' ? [{ worker: l.value, attempt: 1, state: TaskState.Running, slice: slices[i] }] : []));
  const refused = launched.find((l): l is PromiseRejectedResult => l.status === 'rejected');

  if (refused) {
    const detail = refused.reason instanceof Error ? refused.reason.message : String(refused.reason);
    await fail(db, farm, run, { ...state, farm: { pieces, assembly: null } }, detail, job);
    return detail;
  }

  await saveState(db, run, { ...state, farm: { pieces, assembly: null } }, { kind: 'started' });
  return null;
}

export async function startRender(db: Db, farm: RenderFarm | null, scope: RenderScope, req: RenderRequest, storage: RenderStorage): Promise<RenderStart> {
  const runs = farm ? await listNodeRuns(db, { orgId: scope.orgId, nodeId: scope.nodeId }) : [];
  const refused = refusal(farm, runs, scope.plan ?? null, req);
  if (refused || !farm) {
    return { ok: false, ...(refused ?? { error: RenderRefusal.NotConfigured }) };
  }

  const run = await enqueue(db, scope, req);
  const detail = await launch(db, farm, storage, run, req.job);
  if (detail) {
    return { ok: false, error: RenderRefusal.Unavailable, detail };
  }
  return { ok: true, runId: run.id, quote: stateOf(run).quote };
}

export async function startBatch(db: Db, farm: RenderFarm | null, scope: RenderScope, rows: BatchRow[], storage: RenderStorage): Promise<BatchStart> {
  const runs = farm ? await listNodeRuns(db, { orgId: scope.orgId, nodeId: scope.nodeId }) : [];
  for (const [i, row] of rows.entries()) {
    const refused = refusal(farm, runs, scope.plan ?? null, row.req);
    if (refused) {
      return { ok: false, error: refused.error, detail: refused.detail ? `row ${i + 1}: ${refused.detail}` : undefined };
    }
  }
  if (!farm) {
    return { ok: false, error: RenderRefusal.NotConfigured };
  }

  const id = crypto.randomUUID();
  const queued: NodeRun[] = [];
  for (const [i, row] of rows.entries()) {
    queued.push(await enqueue(db, scope, row.req, { batch: { id, row: i + 1, name: row.name, rows: rows.length } }));
  }
  await Promise.all(queued.slice(0, BATCH_CONCURRENCY).map((run, i) => launch(db, farm, storage, run, rows[i].req.job)));

  const credits = queued.reduce((sum, run) => sum + stateOf(run).quote.credits, 0);
  return { ok: true, batchId: id, rows: rows.length, credits };
}

const batchOf = (run: NodeRun) => stateOf(run).batch;
const launched = (run: NodeRun) => (stateOf(run).farm?.pieces.length ?? 0) > 0;

export function batchView(runs: NodeRun[]): BatchView | null {
  const id = runs.filter((r) => isRender(r) && batchOf(r)).at(-1)?.params.batch as BatchTag | undefined;
  if (!id) {
    return null;
  }
  const rows = runs.filter((r) => batchOf(r)?.id === id.id).sort((a, b) => batchOf(a)!.row - batchOf(b)!.row);
  return {
    id: id.id,
    credits: rows.reduce((sum, r) => sum + (stateOf(r).quote?.credits ?? 0), 0),
    rows: rows.map((r) => ({ row: batchOf(r)!.row, name: batchOf(r)!.name, runId: r.id, status: r.status, progress: progressOf(r.params), error: r.error, assetId: r.outputAssetId }))
  };
}

async function launchQueued(db: Db, farm: RenderFarm, storage: RenderStorage, run: NodeRun, job: FarmJob): Promise<Step> {
  const batch = batchOf(run);
  const siblings = await listNodeRuns(db, { orgId: run.orgId, nodeId: run.nodeId });
  const busy = siblings.filter((r) => r.id !== run.id && isActive(r) && batchOf(r)?.id === batch?.id && launched(r)).length;
  if (busy >= BATCH_CONCURRENCY) {
    return Step.Pending;
  }
  const detail = await launch(db, farm, storage, run, job);
  return detail ? Step.Failed : Step.Pending;
}

async function relaunch(db: Db, farm: RenderFarm, storage: RenderStorage, run: NodeRun, job: FarmJob, slice: Slice, attempt: number): Promise<Piece> {
  const worker = await launchPiece(farm, job, slice, await pieceLinks(db, storage, stateOf(run).scope, run.id, job, slice));
  return { worker, attempt, state: TaskState.Running, slice };
}

async function retryPiece(db: Db, farm: RenderFarm, storage: RenderStorage, run: NodeRun, job: FarmJob, piece: Piece, check: TaskCheck): Promise<Piece[]> {
  await Promise.allSettled([stopWorker(farm, piece.worker)]);
  const split = check.error === WORKER_GONE ? halves(job, piece.slice) : null;
  if (split) {
    return Promise.all(split.map((slice) => relaunch(db, farm, storage, run, job, slice, 1)));
  }
  return [await relaunch(db, farm, storage, run, job, piece.slice, piece.attempt + 1)];
}

function failure(job: FarmJob, piece: Piece, error: string): string {
  const tooLarge = error.match(TOO_LARGE)?.[0];
  if (tooLarge) {
    return tooLarge;
  }
  if (error === WORKER_GONE) {
    return `${framesOf(job, piece.slice)} did not finish on a render worker even split down to ${piece.slice.size} frames: the scene is too heavy for the farm. Shorten the 3D shots, lower the motion blur samples or the resolution.`;
  }
  return `${framesOf(job, piece.slice)} failed after ${piece.attempt} attempts: ${error}`;
}

function hopeless(job: FarmJob, piece: Piece, check: TaskCheck): boolean {
  if (check.state !== TaskState.Failed) {
    return false;
  }
  if (TOO_LARGE.test(check.error ?? '')) {
    return true;
  }
  if (check.error === WORKER_GONE && halves(job, piece.slice)) {
    return false;
  }
  return piece.attempt >= MAX_ATTEMPTS;
}

async function startAssembly(db: Db, farm: RenderFarm, storage: RenderStorage, run: NodeRun, state: RenderState, job: FarmJob, attempt: number): Promise<Step> {
  const slices = state.farm.pieces.map((p) => p.slice);
  const others = slices.filter((slice) => slice.index > 0).map((slice) => signedDownload(db, workPath(state.scope, run.id, pieceFile(job, slice))));
  const links = { pieces: await Promise.all(others), output: await signedUpload(db, outputPath(state, run.id)), maxBytes: await storage.limit() };
  await launchAssembly(farm, state.farm.pieces[0].worker, job, slices, links);
  await saveState(db, run, { ...state, farm: { ...state.farm, assembly: { attempt } } }, { kind: 'assembling' });
  return Step.Pending;
}

async function advancePieces(db: Db, farm: RenderFarm, storage: RenderStorage, run: NodeRun, state: RenderState, job: FarmJob): Promise<Step> {
  const pending = (p: Piece): Promise<TaskCheck> => (p.state === TaskState.Done ? Promise.resolve({ state: TaskState.Done, error: null }) : checkTask(farm, p.worker, FarmTask.Piece));
  const checks = await Promise.all(state.farm.pieces.map(pending));

  const spent = state.farm.pieces.findIndex((p, i) => hopeless(job, p, checks[i]));
  if (spent >= 0) {
    return fail(db, farm, run, state, failure(job, state.farm.pieces[spent], checks[spent].error ?? 'render failed'), job);
  }

  const landed = state.farm.pieces.filter((p, i) => p.slice.index > 0 && p.state !== TaskState.Done && checks[i].state === TaskState.Done);
  await Promise.allSettled(landed.map((p) => stopWorker(farm, p.worker)));

  const next = await Promise.all(
    state.farm.pieces.map((p, i) => (checks[i].state === TaskState.Failed ? retryPiece(db, farm, storage, run, job, p, checks[i]) : Promise.resolve([{ ...p, state: checks[i].state }])))
  );
  const pieces = next.flat();
  const progress = { ...state.progress, chunks: pieces.length, chunksDone: pieces.filter((p) => p.state === TaskState.Done).length };
  const saved = await saveState(db, run, { ...state, progress, farm: { ...state.farm, pieces } });

  if (pieces.every((p) => p.state === TaskState.Done)) {
    return startAssembly(db, farm, storage, run, saved, job, 1);
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
  if (!state.farm.pieces.length) {
    return launchQueued(db, farm, storage, run, job);
  }
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
