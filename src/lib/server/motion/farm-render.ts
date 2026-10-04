import type { AudioEntry } from '$lib/motion/audio-plan';
import { chunkPlan, type ChunkPlan, type RenderEvent } from '$lib/motion/server-render';
import { FONT_CSS_ORIGIN, FONT_FILE_ORIGIN } from '$lib/motion/hyperframes/csp';
import { ExportFormat, FORMAT, Master, Quality } from '$lib/motion/export-formats';
import { assembleArgs, audioMixArgs, concatList, zipArgs } from './render-commands';
import { FARM_JOB_DIR, FARM_RUNTIME_DIR, type FarmWorker, type RenderFarm } from './render-farm';

export type FarmJob = { html: string; width: number; height: number; fps: number; totalFrames: number; audio: AudioEntry[]; allowHosts: string[]; format: ExportFormat; quality: Quality; motionBlur: Shutter | null };

export type Shutter = { shutterAngle: number; shutterPhase: number; samples: number };

export class RenderFailure extends Error {}

export enum RenderRoute {
  Chunked = 'chunked',
  Whole = 'whole'
}

const RUNTIME_HOSTS = ['cdn.jsdelivr.net', new URL(FONT_CSS_ORIGIN).host, new URL(FONT_FILE_ORIGIN).host];
const OUTPUT_TAIL = 600;
const MAX_PARALLEL_CHUNKS = 16;
const WHOLE_CAPTURE_WORKERS = 6;
const BLUR_BUDGET = 4000;
const FULL_HD_PIXELS = 1920 * 1080;

const blurWork = (job: FarmJob) => (job.motionBlur ? (job.totalFrames * job.motionBlur.samples * job.width * job.height) / FULL_HD_PIXELS : 0);

const WORKER_VCPUS: Record<RenderRoute, number> = {
  [RenderRoute.Chunked]: 4,
  [RenderRoute.Whole]: 8
};

const WORKER_TIMEOUT_MS = 5 * 60_000;

type Rule = { because: string; applies: (job: FarmJob) => boolean };

const WHOLE_ONLY: Rule[] = [
  { because: 'chunked renders run at 24, 30 or 60 fps only', applies: (job) => ![24, 30, 60].includes(job.fps) },
  { because: 'the distributed producer has no motion blur', applies: (job) => job.motionBlur !== null }
];

const REFUSED: Rule[] = [
  { because: 'H.265 renders at 24, 30 or 60 fps without motion blur', applies: (job) => FORMAT[job.format].master === Master.H265 && routeOf(job) === RenderRoute.Whole },
  { because: 'motion blur cannot render Video clips: turn it off or remove the video', applies: (job) => job.motionBlur !== null && job.html.includes('<video') },
  { because: `motion blur renders up to ${BLUR_BUDGET} samples at 1080p on one machine: lower the samples, the frame rate or the length`, applies: (job) => blurWork(job) > BLUR_BUDGET }
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
const WORKER = `${FARM_RUNTIME_DIR}/render-chunk.mjs`;
const MIX = `${FARM_JOB_DIR}/mix.m4a`;
const LIST = `${FARM_JOB_DIR}/chunks.txt`;
const FRAMES_DIR = `${FARM_JOB_DIR}/frames`;

const WORKER_SCRIPT = `import { readFileSync } from 'node:fs';
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

const masterOf = (job: FarmJob) => MASTER[FORMAT[job.format].master];
const chunkPath = (job: FarmJob, i: number) => `${FARM_JOB_DIR}/c${i}.${masterOf(job).ext}`;
const outPath = (job: FarmJob) => `${FARM_JOB_DIR}/out.${FORMAT[job.format].ext}`;

export function routeOf(job: FarmJob): RenderRoute {
  return WHOLE_ONLY.some((rule) => rule.applies(job)) ? RenderRoute.Whole : RenderRoute.Chunked;
}

export function farmProblem(job: FarmJob): string | null {
  return REFUSED.find((rule) => rule.applies(job))?.because ?? null;
}

export function farmChunks(job: FarmJob): ChunkPlan {
  return routeOf(job) === RenderRoute.Whole ? { size: job.totalFrames, count: 1 } : chunkPlan(job.totalFrames);
}

type WorkerSpec = { route: RenderRoute; project: string; planDir: string; index: number; out: string; config: Record<string, unknown> };

function workerSpec(job: FarmJob, index: number, chunkSize: number): WorkerSpec {
  const { format, codec } = masterOf(job);
  const blur = job.motionBlur ? { motionBlur: { shutterAngle: job.motionBlur.shutterAngle, shutterPhase: job.motionBlur.shutterPhase, samplesPerFrame: job.motionBlur.samples } } : {};
  const base = { fps: job.fps, quality: job.quality, format, ...blur };
  const route = routeOf(job);
  const config = route === RenderRoute.Chunked ? { ...base, ...(codec ? { codec } : {}), width: job.width, height: job.height, chunkSize, maxParallelChunks: MAX_PARALLEL_CHUNKS, runtimeCap: 'none' } : { ...base, workers: WHOLE_CAPTURE_WORKERS };
  return { route, project: PROJECT_DIR, planDir: PLAN_DIR, index, out: chunkPath(job, index), config };
}

async function must(worker: FarmWorker, what: string, cmd: string, args: string[]): Promise<void> {
  const r = await worker.run(cmd, args);
  if (r.exitCode !== 0) {
    throw new RenderFailure(`${what} failed: ${r.output.trim().slice(-OUTPUT_TAIL)}`);
  }
}

async function renderChunkOn(worker: FarmWorker, job: FarmJob, index: number, chunkSize: number): Promise<void> {
  await worker.write([
    { path: `${PROJECT_DIR}/index.html`, content: Buffer.from(job.html) },
    { path: WORKER, content: Buffer.from(WORKER_SCRIPT) },
    { path: SPEC, content: Buffer.from(JSON.stringify(workerSpec(job, index, chunkSize))) }
  ]);
  await must(worker, `chunk ${index}`, 'node', [WORKER, SPEC]);
}

async function mixOn(worker: FarmWorker, job: FarmJob): Promise<string | null> {
  const args = FORMAT[job.format].audio ? audioMixArgs(job.audio, job.totalFrames / job.fps, MIX) : null;
  if (!args) {
    return null;
  }
  await must(worker, 'audio mix', 'ffmpeg', args);
  return MIX;
}

async function collect(head: FarmWorker, others: FarmWorker[], job: FarmJob, count: number): Promise<void> {
  const chunks = await Promise.all(others.map((w, k) => w.read(chunkPath(job, k + 1))));
  const missing = chunks.findIndex((c) => !c);
  if (missing >= 0) {
    throw new RenderFailure(`chunk ${missing + 1} produced no file`);
  }
  const files = chunks.map((content, k) => ({ path: chunkPath(job, k + 1), content: content as Buffer }));
  const list = { path: LIST, content: Buffer.from(concatList(Array.from({ length: count }, (_, i) => chunkPath(job, i)))) };
  await head.write([...files, list]);
}

async function finishOn(head: FarmWorker, job: FarmJob, audio: string | null): Promise<void> {
  if (job.format !== ExportFormat.PngSequence) {
    await must(head, 'assemble', 'ffmpeg', assembleArgs({ list: LIST, audio, out: outPath(job), format: job.format }));
    return;
  }
  await must(head, 'frames folder', 'mkdir', ['-p', FRAMES_DIR]);
  await must(head, 'assemble', 'ffmpeg', assembleArgs({ list: LIST, audio, out: FRAMES_DIR, format: job.format }));
  await must(head, 'zip', 'bash', zipArgs(FRAMES_DIR, outPath(job)));
}

export async function renderOnFarm(farm: RenderFarm, job: FarmJob, onEvent: (e: RenderEvent) => void): Promise<Buffer> {
  const refused = farmProblem(job);
  if (refused) {
    throw new RenderFailure(refused);
  }
  const { size, count } = farmChunks(job);
  const spec = { allowHosts: [...new Set([...job.allowHosts, ...RUNTIME_HOSTS])], timeoutMs: WORKER_TIMEOUT_MS, vcpus: WORKER_VCPUS[routeOf(job)] };
  const opened = await Promise.allSettled(Array.from({ length: count }, () => farm.open(spec)));
  const workers = opened.flatMap((o) => (o.status === 'fulfilled' ? [o.value] : []));

  try {
    const missing = opened.find((o) => o.status === 'rejected');
    if (missing) {
      throw new RenderFailure(`no render worker: ${String((missing as PromiseRejectedResult).reason?.message ?? missing)}`);
    }

    const [head, ...others] = workers;
    const chunkDone = (i: number) => renderChunkOn(workers[i], job, i, size).then(() => onEvent({ kind: 'chunk' }));
    const [audio] = await Promise.all([mixOn(head, job), ...workers.map((_, i) => chunkDone(i))]);

    await collect(head, others, job, count);
    onEvent({ kind: 'assembling' });
    await finishOn(head, job, audio);

    const bytes = await head.read(outPath(job));
    if (!bytes) {
      throw new RenderFailure('assemble produced no file');
    }
    return bytes;
  } finally {
    await Promise.allSettled(workers.map((w) => w.stop()));
  }
}
