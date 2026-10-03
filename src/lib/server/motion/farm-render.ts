import type { AudioEntry } from '$lib/motion/audio-plan';
import { chunkPlan, type RenderEvent } from '$lib/motion/server-render';
import { FONT_CSS_ORIGIN, FONT_FILE_ORIGIN } from '$lib/motion/hyperframes/csp';
import { assembleArgs, audioMixArgs, concatList } from './render-commands';
import { FARM_JOB_DIR, FARM_RUNTIME_DIR, type FarmWorker, type RenderFarm } from './render-farm';

export type FarmJob = { html: string; width: number; height: number; fps: number; totalFrames: number; audio: AudioEntry[]; allowHosts: string[] };

export class RenderFailure extends Error {}

const RUNTIME_HOSTS = ['cdn.jsdelivr.net', new URL(FONT_CSS_ORIGIN).host, new URL(FONT_FILE_ORIGIN).host];
const WORKER_TIMEOUT_MS = 5 * 60_000;
const OUTPUT_TAIL = 600;

const PROJECT_DIR = `${FARM_JOB_DIR}/project`;
const PLAN_DIR = `${FARM_JOB_DIR}/plan`;
const WORKER = `${FARM_RUNTIME_DIR}/render-chunk.mjs`;
const MIX = `${FARM_JOB_DIR}/mix.m4a`;
const LIST = `${FARM_JOB_DIR}/chunks.txt`;
const OUT = `${FARM_JOB_DIR}/out.mp4`;

const chunkPath = (i: number) => `${FARM_JOB_DIR}/c${i}.mp4`;

const WORKER_SCRIPT = `import { plan, renderChunk } from '@hyperframes/producer/distributed';
const [project, planDir, fps, width, height, chunkSize, index, out] = process.argv.slice(2);
await plan(project, { fps: Number(fps), width: Number(width), height: Number(height), format: 'mp4', quality: 'high', chunkSize: Number(chunkSize), maxParallelChunks: 16, runtimeCap: 'none' }, planDir);
const r = await renderChunk(planDir, Number(index), out);
console.log(JSON.stringify({ frames: r.framesEncoded, captureMs: r.captureStageMs, encodeMs: r.encodeStageMs }));
`;

async function must(worker: FarmWorker, what: string, cmd: string, args: string[]): Promise<void> {
  const r = await worker.run(cmd, args);
  if (r.exitCode !== 0) {
    throw new RenderFailure(`${what} failed: ${r.output.trim().slice(-OUTPUT_TAIL)}`);
  }
}

async function renderChunkOn(worker: FarmWorker, job: FarmJob, index: number, chunkSize: number): Promise<void> {
  await worker.write([
    { path: `${PROJECT_DIR}/index.html`, content: Buffer.from(job.html) },
    { path: WORKER, content: Buffer.from(WORKER_SCRIPT) }
  ]);
  const args = [WORKER, PROJECT_DIR, PLAN_DIR, job.fps, job.width, job.height, chunkSize, index, chunkPath(index)];
  await must(worker, `chunk ${index}`, 'node', args.map(String));
}

async function mixOn(worker: FarmWorker, job: FarmJob): Promise<string | null> {
  const args = audioMixArgs(job.audio, job.totalFrames / job.fps, MIX);
  if (!args) {
    return null;
  }
  await must(worker, 'audio mix', 'ffmpeg', args);
  return MIX;
}

async function collect(head: FarmWorker, others: FarmWorker[], count: number): Promise<void> {
  const chunks = await Promise.all(others.map((w, k) => w.read(chunkPath(k + 1))));
  const missing = chunks.findIndex((c) => !c);
  if (missing >= 0) {
    throw new RenderFailure(`chunk ${missing + 1} produced no file`);
  }
  const files = chunks.map((content, k) => ({ path: chunkPath(k + 1), content: content as Buffer }));
  const list = { path: LIST, content: Buffer.from(concatList(Array.from({ length: count }, (_, i) => chunkPath(i)))) };
  await head.write([...files, list]);
}

export async function renderOnFarm(farm: RenderFarm, job: FarmJob, onEvent: (e: RenderEvent) => void): Promise<Buffer> {
  const { size, count } = chunkPlan(job.totalFrames);
  const spec = { allowHosts: [...new Set([...job.allowHosts, ...RUNTIME_HOSTS])], timeoutMs: WORKER_TIMEOUT_MS };
  const opened = await Promise.allSettled(Array.from({ length: count }, () => farm.open(spec)));
  const workers = opened.flatMap((o) => (o.status === 'fulfilled' ? [o.value] : []));

  try {
    const refused = opened.find((o) => o.status === 'rejected');
    if (refused) {
      throw new RenderFailure(`no render worker: ${String((refused as PromiseRejectedResult).reason?.message ?? refused)}`);
    }

    const [head, ...others] = workers;
    const chunkDone = (i: number) => renderChunkOn(workers[i], job, i, size).then(() => onEvent({ kind: 'chunk' }));
    const [audio] = await Promise.all([mixOn(head, job), ...workers.map((_, i) => chunkDone(i))]);

    await collect(head, others, count);
    onEvent({ kind: 'assembling' });
    await must(head, 'assemble', 'ffmpeg', assembleArgs({ list: LIST, audio, out: OUT }));

    const bytes = await head.read(OUT);
    if (!bytes) {
      throw new RenderFailure('assemble produced no file');
    }
    return bytes;
  } finally {
    await Promise.allSettled(workers.map((w) => w.stop()));
  }
}
