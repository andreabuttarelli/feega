import type { AudioEntry } from '$lib/motion/audio-plan';
import { chunkPlan, type ChunkPlan } from '$lib/motion/server-render';
import { FLAT_FRAME_MS, frameCosts, type CostSpan } from '$lib/motion/render-cost';
import { CHUNK_VCPUS, RenderClass, WHOLE_VCPUS } from '$lib/motion/render-quote';
import { FONT_CSS_ORIGIN, FONT_FILE_ORIGIN } from '$lib/motion/hyperframes/csp';
import { ExportFormat, FORMAT, Master, Quality } from '$lib/motion/export-formats';
import { assembleArgs, audioMixArgs, concatList, zipArgs } from './render-commands';
import { FARM_JOB_DIR, FARM_RUNTIME_DIR, Network, type FarmWorker, type RenderFarm } from './render-farm';
import { stripSteps, stripVideos } from './video-strips';
import type { Frame } from './frames';

export type FarmJob = { html: string; width: number; height: number; fps: number; totalFrames: number; audio: AudioEntry[]; allowHosts: string[]; format: ExportFormat; quality: Quality; motionBlur: Shutter | null; cost?: CostSpan[]; renderClass?: RenderClass };

export type Slice = { index: number; size: number };

export type Shutter = { shutterAngle: number; shutterPhase: number; samples: number };

export enum RenderRoute {
  Chunked = 'chunked',
  Whole = 'whole'
}

export enum FarmTask {
  Piece = 'piece',
  Assembly = 'assembly',
  Stills = 'stills',
  Capture = 'capture'
}

export enum TaskState {
  Running = 'running',
  Done = 'done',
  Failed = 'failed'
}

export type Step = { what: string; cmd: string; args: string[] };
export type TaskCheck = { state: TaskState; error: string | null; log?: string };
export type PieceLinks = { upload: string | null; storageHost: string; maxBytes: number };
export type AssemblyLinks = { pieces: string[]; output: string; maxBytes: number };

const RUNTIME_HOSTS = ['cdn.jsdelivr.net', new URL(FONT_CSS_ORIGIN).host, new URL(FONT_FILE_ORIGIN).host];
const MAX_PARALLEL_CHUNKS_CEILING = 256;
const WHOLE_CAPTURE_WORKERS = 6;
const FULL_HD_PIXELS = 1920 * 1080;
const LIFETIME_SAFETY = 0.8;
const HEAVY_MARGIN = 3;
const LOG_TAIL_CHARS = 600;
const PROGRESS_EVERY_MS = 20_000;
const CAPTURED_FRAME = 'frame_';
const BYTES_PER_MB = 1024 * 1024;
const MINUTE_MS = 60_000;
export const WORKER_GONE = 'render worker stopped before it finished: it timed out or crashed';
const MIN_SPLIT_FRAMES = 20;

const WORKER: Record<RenderRoute, { vcpus: (job: FarmJob) => number; timeoutMs: number }> = {
  [RenderRoute.Chunked]: { vcpus: (job) => CHUNK_VCPUS[job.renderClass ?? RenderClass.Flat], timeoutMs: 20 * MINUTE_MS },
  [RenderRoute.Whole]: { vcpus: () => WHOLE_VCPUS, timeoutMs: 120 * MINUTE_MS }
};

const LIFETIME = { bootMs: 2 * MINUTE_MS, msPerFullHdFrame: 500, assemblyMs: 5 * MINUTE_MS };

export const MAX_ATTEMPTS = 2;
export const RENDER_DEADLINE_MS = (MAX_ATTEMPTS + 1) * WORKER[RenderRoute.Whole].timeoutMs;

type Rule = { because: string; applies: (job: FarmJob) => boolean };

const WHOLE_ONLY: Rule[] = [{ because: 'chunked renders run at 24, 30 or 60 fps only', applies: (job) => ![24, 30, 60].includes(job.fps) }];

const REFUSED: Rule[] = [
  { because: 'H.265 renders at 24, 30 or 60 fps without motion blur', applies: (job) => FORMAT[job.format].master === Master.H265 && routeOf(job) === RenderRoute.Whole },
  { because: `motion blur this long cannot finish even split over every render machine: lower the samples, the frame rate or the length`, applies: (job) => heaviestWork(job) > WORKER[routeOf(job)].timeoutMs * LIFETIME_SAFETY }
];

export const PRODUCER_BLUR_PATCHES: [string, string][] = [
  ['format: plan2.dimensions.format === "mp4" ? "jpeg" : "png",', 'format: "png",'],
  ['lockWarmupTicks: true,', 'lockWarmupTicks: true, motionBlur: JSON.parse(process.env.FEEGA_BLUR),'],
  ['let forceScreenshotForChunk = encoder2.forceScreenshot;', 'let forceScreenshotForChunk = true;']
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
const STILLS = `${FARM_JOB_DIR}/stills.json`;
const STILL_WIDTH = 960;
const STILL_QUALITY = 4;
const STILLS_TIMEOUT_MS = 12 * MINUTE_MS;
const stillPath = (i: number) => `${FARM_JOB_DIR}/still-${i}.jpg`;
const CAPTURE_DIR = `${FARM_JOB_DIR}/capture`;
const CAPTURED = `${FARM_JOB_DIR}/capture.json`;
const CAPTURE_SHOTS = 6;
const CAPTURE_VCPUS = 2;
const CAPTURE_TIMEOUT_MS = 6 * MINUTE_MS;
const HTTPS = 'https:';

const stepsPath = (task: FarmTask) => `${FARM_JOB_DIR}/steps-${task}.json`;
const resultPath = (task: FarmTask) => `${FARM_JOB_DIR}/result-${task}.json`;
const logPath = (task: FarmTask) => `${FARM_JOB_DIR}/log-${task}.txt`;

const PRODUCER_DIST = `${FARM_RUNTIME_DIR}/node_modules/@hyperframes/producer/dist`;

const CHUNK_SOURCE = `import { readFileSync, writeFileSync } from 'node:fs';
const spec = JSON.parse(readFileSync(process.argv[2], 'utf8'));
async function distributed() {
  if (!spec.blur) {
    return import('@hyperframes/producer/distributed');
  }
  let source = readFileSync('${PRODUCER_DIST}/distributed.js', 'utf8');
  for (const [from, to] of ${JSON.stringify(PRODUCER_BLUR_PATCHES)}) {
    if (!source.includes(from)) {
      throw new Error('producer patch anchor missing: ' + from);
    }
    source = source.replace(from, to);
  }
  writeFileSync('${PRODUCER_DIST}/distributed-blur.js', source);
  process.env.FEEGA_BLUR = JSON.stringify(spec.blur);
  return import('${PRODUCER_DIST}/distributed-blur.js');
}
if (spec.route === 'chunked') {
  const { plan, renderChunk } = await distributed();
  await plan(spec.project, spec.config, spec.planDir);
  const r = await renderChunk(spec.planDir, spec.index, spec.out);
  console.log(JSON.stringify({ frames: r.framesEncoded, captureMs: r.captureStageMs, encodeMs: r.encodeStageMs }));
} else {
  const { createRenderJob, executeRenderJob } = await import('@hyperframes/producer');
  await executeRenderJob(createRenderJob(spec.config), spec.project, spec.out);
}
`;

const STEPS_SOURCE = `import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const [stepsFile, resultFile, logFile] = process.argv.slice(2);
const tail = () => {
  try {
    return readFileSync(logFile, 'utf8').trim().slice(-${LOG_TAIL_CHARS});
  } catch {
    return '';
  }
};
const captured = () => {
  try {
    return readdirSync('${FARM_JOB_DIR}', { recursive: true }).filter((f) => String(f).includes('${CAPTURED_FRAME}')).length;
  } catch {
    return 0;
  }
};
let reported = 0;
const progress = setInterval(() => {
  const now = captured();
  if (now !== reported) {
    reported = now;
    console.log(JSON.stringify({ progress: now + ' frames captured' }));
  }
}, ${PROGRESS_EVERY_MS});
const run = (step) => new Promise((done) => {
  const child = spawn(step.cmd, step.args, { cwd: '${FARM_RUNTIME_DIR}', stdio: ['ignore', 'inherit', 'inherit'] });
  child.on('error', (e) => done({ status: 1, message: e.message }));
  child.on('close', (status) => done({ status, message: null }));
});
let error = null;
try {
  for (const step of JSON.parse(readFileSync(stepsFile, 'utf8'))) {
    const started = Date.now();
    const r = await run(step);
    console.log(JSON.stringify({ step: step.what, status: r.status, ms: Date.now() - started }));
    if (r.status !== 0) {
      error = step.what + ' failed: ' + (r.message ?? tail());
      break;
    }
  }
} catch (e) {
  error = 'steps failed: ' + (e?.message ?? String(e));
}
clearInterval(progress);
writeFileSync(resultFile, JSON.stringify({ ok: error === null, error }));
`;

const masterOf = (job: FarmJob) => MASTER[FORMAT[job.format].master];
export const pieceFile = (job: FarmJob, slice: Slice) => `c${slice.index * slice.size}.${masterOf(job).ext}`;
const chunkPath = (job: FarmJob, slice: Slice) => `${FARM_JOB_DIR}/${pieceFile(job, slice)}`;
const isHead = (slice: Slice) => slice.index === 0;
const outPath = (job: FarmJob) => `${FARM_JOB_DIR}/out.${FORMAT[job.format].ext}`;

export function routeOf(job: FarmJob): RenderRoute {
  return WHOLE_ONLY.some((rule) => rule.applies(job)) ? RenderRoute.Whole : RenderRoute.Chunked;
}

export function farmProblem(job: FarmJob): string | null {
  return REFUSED.find((rule) => rule.applies(job))?.because ?? null;
}

const samplesOf = (job: FarmJob) => job.motionBlur?.samples ?? 1;

function pieceWork(job: FarmJob, slice: Slice): number {
  const start = slice.index * slice.size;
  const frames = Math.max(0, Math.min(job.totalFrames, start + slice.size) - start);
  const heavy = frameCosts(job.totalFrames, job.cost ?? []).slice(start, start + slice.size).reduce((sum, ms) => sum + ms - FLAT_FRAME_MS, 0);
  const flat = (frames * job.width * job.height * LIFETIME.msPerFullHdFrame) / FULL_HD_PIXELS;
  return LIFETIME.bootMs + samplesOf(job) * (flat + heavy * HEAVY_MARGIN);
}

function lifetimeMs(job: FarmJob, slice: Slice): number {
  const head = slice.index === 0 ? LIFETIME.assemblyMs : 0;
  return Math.round(Math.min(WORKER[routeOf(job)].timeoutMs, pieceWork(job, slice) + head));
}

function heaviestWork(job: FarmJob): number {
  return Math.max(...firstSlices(job).map((slice) => pieceWork(job, slice)));
}

export function farmChunks(job: FarmJob): ChunkPlan {
  if (routeOf(job) === RenderRoute.Whole) {
    return { size: job.totalFrames, count: 1 };
  }
  return chunkPlan(job.totalFrames, frameCosts(job.totalFrames, job.cost ?? []).map((ms) => ms * samplesOf(job)));
}

export function firstSlices(job: FarmJob): Slice[] {
  const { size, count } = farmChunks(job);
  return Array.from({ length: count }, (_, index) => ({ index, size }));
}

export function halves(job: FarmJob, slice: Slice): Slice[] | null {
  const last = (slice.index + 1) * slice.size >= job.totalFrames;
  if (routeOf(job) === RenderRoute.Whole || slice.size < MIN_SPLIT_FRAMES || (slice.size % 2 !== 0 && !last)) {
    return null;
  }
  const size = Math.ceil(slice.size / 2);
  return [0, 1].map((k) => ({ index: slice.index * 2 + k, size })).filter((half) => half.index * half.size < job.totalFrames);
}

export function framesOf(job: FarmJob, slice: Slice): string {
  const start = slice.index * slice.size;
  return `frames ${start}–${Math.min(job.totalFrames, start + slice.size) - 1}`;
}

type ProducerShutter = { shutterAngle: number; shutterPhase: number; samplesPerFrame: number };
type ChunkSpec = { route: RenderRoute; project: string; planDir: string; index: number; out: string; blur: ProducerShutter | null; config: Record<string, unknown> };

const producerShutter = (s: Shutter): ProducerShutter => ({ shutterAngle: s.shutterAngle, shutterPhase: s.shutterPhase, samplesPerFrame: s.samples });

function chunkSpec(job: FarmJob, slice: Slice): ChunkSpec {
  const { format, codec } = masterOf(job);
  const blur = job.motionBlur ? producerShutter(job.motionBlur) : null;
  const base = { fps: job.fps, quality: job.quality, format };
  const route = routeOf(job);
  const config = route === RenderRoute.Chunked ? { ...base, ...(codec ? { codec } : {}), width: job.width, height: job.height, chunkSize: slice.size, maxParallelChunks: MAX_PARALLEL_CHUNKS_CEILING, runtimeCap: 'none' } : { ...base, ...(blur ? { motionBlur: blur } : {}), workers: WHOLE_CAPTURE_WORKERS };
  return { route, project: PROJECT_DIR, planDir: PLAN_DIR, index: slice.index, out: chunkPath(job, slice), blur: route === RenderRoute.Chunked ? blur : null, config };
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
  await worker.spawn('bash', ['-c', `node ${STEPS_SCRIPT} ${stepsPath(task)} ${resultPath(task)} ${logPath(task)} > ${logPath(task)} 2>&1`]);
}

export async function launchPiece(farm: RenderFarm, job: FarmJob, slice: Slice, links: PieceLinks): Promise<string> {
  const route = routeOf(job);
  const hosts = [...new Set([...job.allowHosts, links.storageHost, ...RUNTIME_HOSTS])];
  const worker = await farm.open({ allowHosts: hosts, timeoutMs: lifetimeMs(job, slice), vcpus: WORKER[route].vcpus(job) });

  const what = framesOf(job, slice);
  const render: Step = { what, cmd: 'node', args: [CHUNK_SCRIPT, SPEC] };
  const file = chunkPath(job, slice);
  const upload = links.upload ? [sizeStep(`${what} size check`, 'a part of this render', file, links.maxBytes), uploadStep(`${what} upload`, file, 'application/octet-stream', links.upload)] : [];

  const page = job.motionBlur ? stripVideos(job.html) : { html: job.html, strips: [] };
  try {
    await worker.write([
      { path: `${PROJECT_DIR}/index.html`, content: Buffer.from(page.html) },
      { path: CHUNK_SCRIPT, content: Buffer.from(CHUNK_SOURCE) },
      { path: SPEC, content: Buffer.from(JSON.stringify(chunkSpec(job, slice))) }
    ]);
    await startSteps(worker, FarmTask.Piece, [...stripSteps(PROJECT_DIR, page.strips), render, ...upload]);
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

export async function launchAssembly(farm: RenderFarm, name: string, job: FarmJob, slices: Slice[], links: AssemblyLinks): Promise<void> {
  const head = await farm.attach(name);
  if (!head) {
    throw new Error(WORKER_GONE);
  }
  const others = slices.filter((slice) => !isHead(slice));
  const downloads = links.pieces.map((url, k) => downloadStep(`${framesOf(job, others[k])} download`, url, chunkPath(job, others[k])));
  const mixArgs = FORMAT[job.format].audio ? audioMixArgs(job.audio, job.totalFrames / job.fps, MIX) : null;
  const mix = mixArgs ? [{ what: 'audio mix', cmd: 'ffmpeg', args: mixArgs }] : [];
  const list = concatList(slices.map((slice) => chunkPath(job, slice)));

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
    const log = await worker.read(logPath(task)).catch(() => null);
    return { state: TaskState.Running, error: null, ...(log ? { log: log.toString().trim().slice(-LOG_TAIL_CHARS) } : {}) };
  }
  const result = JSON.parse(written.toString()) as { ok: boolean; error: string | null };
  return result.ok ? { state: TaskState.Done, error: null } : { state: TaskState.Failed, error: result.error };
}

export async function stopWorker(farm: RenderFarm, name: string): Promise<void> {
  const worker = await farm.attach(name);
  await worker?.stop();
}

function stillSteps(job: FarmJob, times: number[]): Step[] {
  const video = chunkPath(job, { index: 0, size: job.totalFrames });
  const cuts = times.map((t, i): Step => ({ what: `still ${t}s`, cmd: 'ffmpeg', args: ['-y', '-loglevel', 'error', '-ss', String(t), '-i', video, '-frames:v', '1', '-vf', `scale=${STILL_WIDTH}:-2`, '-q:v', String(STILL_QUALITY), stillPath(i)] }));
  const pack = `const fs = require('node:fs'); fs.writeFileSync('${STILLS}', JSON.stringify(${JSON.stringify(times.map((_, i) => stillPath(i)))}.map((p) => fs.readFileSync(p).toString('base64'))));`;
  return [...cuts, { what: 'pack stills', cmd: 'node', args: ['-e', pack] }];
}

export async function launchStills(farm: RenderFarm, job: FarmJob, times: number[]): Promise<string> {
  const plain: FarmJob = { ...job, motionBlur: null };
  const hosts = [...new Set([...plain.allowHosts, ...RUNTIME_HOSTS])];
  const worker = await farm.open({ allowHosts: hosts, timeoutMs: STILLS_TIMEOUT_MS, vcpus: WHOLE_VCPUS });
  const whole = { index: 0, size: plain.totalFrames };
  const spec = { ...chunkSpec(plain, whole), route: RenderRoute.Whole, config: { fps: plain.fps, quality: plain.quality, format: masterOf(plain).format, workers: WHOLE_CAPTURE_WORKERS } };

  try {
    await worker.write([
      { path: `${PROJECT_DIR}/index.html`, content: Buffer.from(plain.html) },
      { path: CHUNK_SCRIPT, content: Buffer.from(CHUNK_SOURCE) },
      { path: SPEC, content: Buffer.from(JSON.stringify(spec)) }
    ]);
    await startSteps(worker, FarmTask.Stills, [{ what: 'render', cmd: 'node', args: [CHUNK_SCRIPT, SPEC] }, ...stillSteps(plain, times)]);
  } catch (e) {
    await worker.stop().catch(() => {});
    throw e;
  }
  return worker.name;
}

export async function readStills(farm: RenderFarm, name: string, times: number[]): Promise<Frame[] | null> {
  const worker = await farm.attach(name);
  const packed = worker ? await worker.read(STILLS) : null;
  if (!packed) {
    return null;
  }
  const images = JSON.parse(packed.toString()) as string[];
  return times.map((time, i) => ({ time, bytes: Buffer.from(images[i], 'base64') }));
}

const CAPTURE_JPEGS = `cd ${CAPTURE_DIR}/screenshots && ls scroll-*.png | sort | head -${CAPTURE_SHOTS} | while read f; do ffmpeg -y -loglevel error -i "$f" -q:v 2 "\${f%.png}.jpg"; done`;
const CAPTURE_PACK = `const fs = require('node:fs'); const dir = '${CAPTURE_DIR}/screenshots'; const shots = fs.readdirSync(dir).filter((f) => /^scroll-\\d+\\.jpg$/.test(f)).sort(); fs.writeFileSync('${CAPTURED}', JSON.stringify(shots.map((name) => ({ name, data: fs.readFileSync(dir + '/' + name).toString('base64') }))));`;

export type CaptureShot = { name: string; bytes: Buffer };

export async function launchCapture(farm: RenderFarm, url: string): Promise<string> {
  if (new URL(url).protocol !== HTTPS) {
    throw new Error(`only a public https page can be captured: ${url}`);
  }
  const worker = await farm.open({ allowHosts: [], network: Network.Open, timeoutMs: CAPTURE_TIMEOUT_MS, vcpus: CAPTURE_VCPUS });
  try {
    await startSteps(worker, FarmTask.Capture, [
      { what: 'capture', cmd: 'npx', args: ['hyperframes', 'capture', url, '-o', CAPTURE_DIR, '--json', '--skip-vision', '--skip-assets', '--max-screenshots', String(CAPTURE_SHOTS + 2)] },
      { what: 'jpeg', cmd: 'bash', args: ['-c', CAPTURE_JPEGS] },
      { what: 'pack capture', cmd: 'node', args: ['-e', CAPTURE_PACK] }
    ]);
  } catch (e) {
    await worker.stop().catch(() => {});
    throw e;
  }
  return worker.name;
}

export async function readCapture(farm: RenderFarm, name: string): Promise<CaptureShot[] | null> {
  const worker = await farm.attach(name);
  const packed = worker ? await worker.read(CAPTURED) : null;
  if (!packed) {
    return null;
  }
  return (JSON.parse(packed.toString()) as { name: string; data: string }[]).map((shot) => ({ name: shot.name, bytes: Buffer.from(shot.data, 'base64') }));
}

export async function awaitTask(farm: RenderFarm, name: string, task: FarmTask, timing: { timeoutMs: number; pollMs: number }): Promise<TaskCheck> {
  const deadline = Date.now() + timing.timeoutMs;
  while (Date.now() < deadline) {
    const check = await checkTask(farm, name, task);
    if (check.state !== TaskState.Running) {
      return check;
    }
    await new Promise((resolve) => setTimeout(resolve, timing.pollMs));
  }
  return { state: TaskState.Failed, error: `${task} did not finish in ${Math.round(timing.timeoutMs / 1000)} s` };
}
