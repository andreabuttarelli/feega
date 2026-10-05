import type { AudioEntry } from '$lib/motion/audio-plan';
import { chunkPlan, type ChunkPlan } from '$lib/motion/server-render';
import { FONT_CSS_ORIGIN, FONT_FILE_ORIGIN } from '$lib/motion/hyperframes/csp';
import { ExportFormat, FORMAT, Master, Quality } from '$lib/motion/export-formats';
import { assembleArgs, audioMixArgs, concatList, zipArgs } from './render-commands';
import { FARM_JOB_DIR, FARM_RUNTIME_DIR, type FarmWorker, type RenderFarm } from './render-farm';

export type FarmJob = { html: string; width: number; height: number; fps: number; totalFrames: number; audio: AudioEntry[]; allowHosts: string[]; format: ExportFormat; quality: Quality; motionBlur: Shutter | null };

export type Shutter = { shutterAngle: number; shutterPhase: number; samples: number };

export enum RenderRoute {
  Chunked = 'chunked',
  Whole = 'whole'
}

export enum FarmTask {
  Piece = 'piece',
  Assembly = 'assembly'
}

export enum TaskState {
  Running = 'running',
  Done = 'done',
  Failed = 'failed'
}

export type Step = { what: string; cmd: string; args: string[] };
export type TaskCheck = { state: TaskState; error: string | null };
export type PieceLinks = { upload: string | null; storageHost: string; maxBytes: number };
export type AssemblyLinks = { pieces: string[]; output: string; maxBytes: number };

const RUNTIME_HOSTS = ['cdn.jsdelivr.net', new URL(FONT_CSS_ORIGIN).host, new URL(FONT_FILE_ORIGIN).host];
const MAX_PARALLEL_CHUNKS = 16;
const WHOLE_CAPTURE_WORKERS = 6;
const FULL_HD_PIXELS = 1920 * 1080;
const MS_PER_BLUR_SAMPLE = 51;
const BLUR_SAFETY = 0.8;
const BYTES_PER_MB = 1024 * 1024;
const MINUTE_MS = 60_000;
const WORKER_GONE = 'render worker stopped before it finished: it timed out or crashed';

const WORKER: Record<RenderRoute, { vcpus: number; timeoutMs: number }> = {
  [RenderRoute.Chunked]: { vcpus: 4, timeoutMs: 20 * MINUTE_MS },
  [RenderRoute.Whole]: { vcpus: 8, timeoutMs: 120 * MINUTE_MS }
};

const LIFETIME = { bootMs: 2 * MINUTE_MS, msPerFullHdFrame: 500, assemblyMs: 5 * MINUTE_MS };

export const MAX_ATTEMPTS = 2;
export const RENDER_DEADLINE_MS = (MAX_ATTEMPTS + 1) * WORKER[RenderRoute.Whole].timeoutMs;

const blurWork = (job: FarmJob) => (job.motionBlur ? (job.totalFrames * job.motionBlur.samples * job.width * job.height) / FULL_HD_PIXELS : 0);
const blurBudget = Math.floor((WORKER[RenderRoute.Whole].timeoutMs * BLUR_SAFETY) / MS_PER_BLUR_SAMPLE);

type Rule = { because: string; applies: (job: FarmJob) => boolean };

const WHOLE_ONLY: Rule[] = [
  { because: 'chunked renders run at 24, 30 or 60 fps only', applies: (job) => ![24, 30, 60].includes(job.fps) },
  { because: 'the distributed producer has no motion blur', applies: (job) => job.motionBlur !== null }
];

const REFUSED: Rule[] = [
  { because: 'H.265 renders at 24, 30 or 60 fps without motion blur', applies: (job) => FORMAT[job.format].master === Master.H265 && routeOf(job) === RenderRoute.Whole },
  { because: 'motion blur cannot render Video clips: turn it off or remove the video', applies: (job) => job.motionBlur !== null && job.html.includes('<video') },
  { because: `motion blur this long cannot finish on one machine: lower the samples, the frame rate or the length`, applies: (job) => blurWork(job) > blurBudget }
];

const MASTER: Record<Master, { format: string; codec?: string; ext: string }> = {
  [Master.H264]: { format: 'mp4', codec: 'h264', ext: 'mp4' },
  [Master.H265]: { format: 'mp4', codec: 'h265', ext: 'mp4' },
  [Master.ProRes]: { format: 'mov', ext: 'mov' },
  [Master.Vp9]: { format: 'webm', ext: 'webm' }
};

const PROJECT_DIR = `${FARM_JOB_DIR}/project`;
const PLAN_DIR = `${FARM_JOB_DIR}/plan`;
const SPEC = `${FARM_JOB_DIR}/spec.json`;
const CHUNK_SCRIPT = `${FARM_RUNTIME_DIR}/render-chunk.mjs`;
const STEPS_SCRIPT = `${FARM_RUNTIME_DIR}/steps.mjs`;
const MIX = `${FARM_JOB_DIR}/mix.m4a`;
const LIST = `${FARM_JOB_DIR}/chunks.txt`;
const FRAMES_DIR = `${FARM_JOB_DIR}/frames`;

const stepsPath = (task: FarmTask) => `${FARM_JOB_DIR}/steps-${task}.json`;
const resultPath = (task: FarmTask) => `${FARM_JOB_DIR}/result-${task}.json`;
const logPath = (task: FarmTask) => `${FARM_JOB_DIR}/log-${task}.txt`;

const CHUNK_SOURCE = `import { readFileSync } from 'node:fs';
const spec = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (spec.route === 'chunked') {
  const { plan, renderChunk } = await import('@hyperframes/producer/distributed');
  await plan(spec.project, spec.config, spec.planDir);
  const r = await renderChunk(spec.planDir, spec.index, spec.out);
  console.log(JSON.stringify({ frames: r.framesEncoded, captureMs: r.captureStageMs, encodeMs: r.encodeStageMs }));
} else {
  const { createRenderJob, executeRenderJob } = await import('@hyperframes/producer');
  await executeRenderJob(createRenderJob(spec.config), spec.project, spec.out);
}
`;

const STEPS_SOURCE = `import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const [stepsFile, resultFile] = process.argv.slice(2);
let error = null;
try {
  for (const step of JSON.parse(readFileSync(stepsFile, 'utf8'))) {
    const r = spawnSync(step.cmd, step.args, { cwd: '${FARM_RUNTIME_DIR}', encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    if (r.status !== 0) {
      error = step.what + ' failed: ' + ((r.stdout ?? '') + (r.stderr ?? '') + (r.error?.message ?? '')).trim().slice(-600);
      break;
    }
  }
} catch (e) {
  error = 'steps failed: ' + (e?.message ?? String(e));
}
writeFileSync(resultFile, JSON.stringify({ ok: error === null, error }));
`;

const masterOf = (job: FarmJob) => MASTER[FORMAT[job.format].master];
export const pieceFile = (job: FarmJob, i: number) => `c${i}.${masterOf(job).ext}`;
const chunkPath = (job: FarmJob, i: number) => `${FARM_JOB_DIR}/${pieceFile(job, i)}`;
const outPath = (job: FarmJob) => `${FARM_JOB_DIR}/out.${FORMAT[job.format].ext}`;

export function routeOf(job: FarmJob): RenderRoute {
  return WHOLE_ONLY.some((rule) => rule.applies(job)) ? RenderRoute.Whole : RenderRoute.Chunked;
}

export function farmProblem(job: FarmJob): string | null {
  return REFUSED.find((rule) => rule.applies(job))?.because ?? null;
}

function lifetimeMs(job: FarmJob, index: number): number {
  const route = routeOf(job);
  const frames = farmChunks(job).size * (job.motionBlur?.samples ?? 1);
  const work = LIFETIME.bootMs + (frames * job.width * job.height * LIFETIME.msPerFullHdFrame) / FULL_HD_PIXELS;
  const head = index === 0 ? LIFETIME.assemblyMs : 0;
  return Math.round(Math.min(WORKER[route].timeoutMs, work + head));
}

export function farmChunks(job: FarmJob): ChunkPlan {
  return routeOf(job) === RenderRoute.Whole ? { size: job.totalFrames, count: 1 } : chunkPlan(job.totalFrames);
}

type ChunkSpec = { route: RenderRoute; project: string; planDir: string; index: number; out: string; config: Record<string, unknown> };

function chunkSpec(job: FarmJob, index: number): ChunkSpec {
  const { format, codec } = masterOf(job);
  const blur = job.motionBlur ? { motionBlur: { shutterAngle: job.motionBlur.shutterAngle, shutterPhase: job.motionBlur.shutterPhase, samplesPerFrame: job.motionBlur.samples } } : {};
  const base = { fps: job.fps, quality: job.quality, format, ...blur };
  const route = routeOf(job);
  const chunkSize = farmChunks(job).size;
  const config = route === RenderRoute.Chunked ? { ...base, ...(codec ? { codec } : {}), width: job.width, height: job.height, chunkSize, maxParallelChunks: MAX_PARALLEL_CHUNKS, runtimeCap: 'none' } : { ...base, workers: WHOLE_CAPTURE_WORKERS };
  return { route, project: PROJECT_DIR, planDir: PLAN_DIR, index, out: chunkPath(job, index), config };
}

const curl = (args: string[]) => ['-sS', '--fail-with-body', '--retry', '3', ...args];
const uploadStep = (what: string, file: string, mime: string, url: string): Step => ({ what, cmd: 'curl', args: curl(['-T', file, '-H', `content-type: ${mime}`, '-H', 'x-upsert: true', url]) });
const downloadStep = (what: string, url: string, file: string): Step => ({ what, cmd: 'curl', args: curl(['-L', url, '-o', file]) });

function sizeStep(what: string, subject: string, file: string, maxBytes: number): Step {
  const mb = Math.round(maxBytes / BYTES_PER_MB);
  const script = `size=$(stat -c%s ${file}); [ "$size" -le ${maxBytes} ] || { echo "too_large: ${subject} is $((size / ${BYTES_PER_MB})) MB, over the ${mb} MB this project's storage accepts per file. Nothing was charged."; exit 1; }`;
  return { what, cmd: 'bash', args: ['-c', script] };
}

async function startSteps(worker: FarmWorker, task: FarmTask, steps: Step[]): Promise<void> {
  await worker.write([
    { path: STEPS_SCRIPT, content: Buffer.from(STEPS_SOURCE) },
    { path: stepsPath(task), content: Buffer.from(JSON.stringify(steps)) }
  ]);
  await worker.spawn('bash', ['-c', `node ${STEPS_SCRIPT} ${stepsPath(task)} ${resultPath(task)} > ${logPath(task)} 2>&1`]);
}

export async function launchPiece(farm: RenderFarm, job: FarmJob, index: number, links: PieceLinks): Promise<string> {
  const route = routeOf(job);
  const hosts = [...new Set([...job.allowHosts, links.storageHost, ...RUNTIME_HOSTS])];
  const worker = await farm.open({ allowHosts: hosts, timeoutMs: lifetimeMs(job, index), vcpus: WORKER[route].vcpus });

  const render: Step = { what: `chunk ${index}`, cmd: 'node', args: [CHUNK_SCRIPT, SPEC] };
  const file = chunkPath(job, index);
  const upload = links.upload ? [sizeStep(`chunk ${index} size check`, 'a part of this render', file, links.maxBytes), uploadStep(`chunk ${index} upload`, file, 'application/octet-stream', links.upload)] : [];

  try {
    await worker.write([
      { path: `${PROJECT_DIR}/index.html`, content: Buffer.from(job.html) },
      { path: CHUNK_SCRIPT, content: Buffer.from(CHUNK_SOURCE) },
      { path: SPEC, content: Buffer.from(JSON.stringify(chunkSpec(job, index))) }
    ]);
    await startSteps(worker, FarmTask.Piece, [render, ...upload]);
  } catch (e) {
    await worker.stop().catch(() => {});
    throw e;
  }
  return worker.name;
}

function joinSteps(job: FarmJob, audio: string | null): Step[] {
  if (job.format !== ExportFormat.PngSequence) {
    return [{ what: 'assemble', cmd: 'ffmpeg', args: assembleArgs({ list: LIST, audio, out: outPath(job), format: job.format }) }];
  }
  return [
    { what: 'frames folder', cmd: 'mkdir', args: ['-p', FRAMES_DIR] },
    { what: 'assemble', cmd: 'ffmpeg', args: assembleArgs({ list: LIST, audio, out: FRAMES_DIR, format: job.format }) },
    { what: 'zip', cmd: 'bash', args: zipArgs(FRAMES_DIR, outPath(job)) }
  ];
}

export async function launchAssembly(farm: RenderFarm, name: string, job: FarmJob, links: AssemblyLinks): Promise<void> {
  const head = await farm.attach(name);
  if (!head) {
    throw new Error(WORKER_GONE);
  }
  const count = links.pieces.length + 1;
  const downloads = links.pieces.map((url, k) => downloadStep(`chunk ${k + 1} download`, url, chunkPath(job, k + 1)));
  const mixArgs = FORMAT[job.format].audio ? audioMixArgs(job.audio, job.totalFrames / job.fps, MIX) : null;
  const mix = mixArgs ? [{ what: 'audio mix', cmd: 'ffmpeg', args: mixArgs }] : [];
  const list = concatList(Array.from({ length: count }, (_, i) => chunkPath(job, i)));

  await head.write([{ path: LIST, content: Buffer.from(list) }]);
  await startSteps(head, FarmTask.Assembly, [
    ...downloads,
    ...mix,
    ...joinSteps(job, mixArgs ? MIX : null),
    sizeStep('size check', 'the file', outPath(job), links.maxBytes),
    uploadStep('upload', outPath(job), FORMAT[job.format].mime, links.output)
  ]);
}

export async function checkTask(farm: RenderFarm, name: string, task: FarmTask): Promise<TaskCheck> {
  const worker = await farm.attach(name);
  if (!worker) {
    return { state: TaskState.Failed, error: WORKER_GONE };
  }
  const written = await worker.read(resultPath(task));
  if (!written) {
    return { state: TaskState.Running, error: null };
  }
  const result = JSON.parse(written.toString()) as { ok: boolean; error: string | null };
  return result.ok ? { state: TaskState.Done, error: null } : { state: TaskState.Failed, error: result.error };
}

export async function stopWorker(farm: RenderFarm, name: string): Promise<void> {
  const worker = await farm.attach(name);
  await worker?.stop();
}
