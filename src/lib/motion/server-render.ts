export enum RenderStage {
  Starting = 'starting',
  Rendering = 'rendering',
  Assembling = 'assembling',
  Saving = 'saving',
  Done = 'done',
  Failed = 'failed'
}

export type ChunkPlan = { size: number; count: number };
export type RenderProgress = { stage: RenderStage; chunksDone: number; chunks: number; totalFrames: number };
export type RenderRunStatus = 'running' | 'finishing' | 'done' | 'failed' | 'expired';
export type RenderView = { id: string; status: RenderRunStatus; progress: RenderProgress | null; error: string | null; assetId: string | null; credits: number | null };
export enum RenderQueue {
  Ticking = 'ticking',
  Stopped = 'stopped'
}

export type ServerRender = { configured: boolean; version: number; saved: boolean; latest: RenderView | null; queue: RenderQueue; uploadLimit?: number | null; assetHref: (id: string) => string };
export type RenderEvent = { kind: 'started' | 'chunk' | 'assembling' | 'saving' | 'done' | 'failed' };

const CHUNK_TARGET_FRAMES = 450;
const MAX_CHUNKS = 8;

enum SplitFor {
  Speed = 'speed',
  Lifetime = 'lifetime'
}

const SPLIT: { for: SplitFor; upTo: number; whileHeaviestOverMs: number }[] = [
  { for: SplitFor.Speed, upTo: 32, whileHeaviestOverMs: 90_000 },
  { for: SplitFor.Lifetime, upTo: 64, whileHeaviestOverMs: 240_000 }
];

const FINAL: ReadonlySet<RenderStage> = new Set([RenderStage.Done, RenderStage.Failed]);

const STAGE_AFTER: Record<RenderEvent['kind'], RenderStage> = {
  started: RenderStage.Rendering,
  chunk: RenderStage.Rendering,
  assembling: RenderStage.Assembling,
  saving: RenderStage.Saving,
  done: RenderStage.Done,
  failed: RenderStage.Failed
};

const even = (n: number) => n + (n % 2);

function heaviestChunk(costs: readonly number[], size: number): number {
  let heaviest = 0;
  for (let start = 0; start < costs.length; start += size) {
    heaviest = Math.max(heaviest, costs.slice(start, start + size).reduce((sum, ms) => sum + ms, 0));
  }
  return heaviest;
}

function planOf(totalFrames: number, count: number): ChunkPlan {
  const size = count > 1 ? even(Math.ceil(totalFrames / count)) : totalFrames;
  return { size, count: Math.ceil(totalFrames / size) };
}

export function chunkPlan(totalFrames: number, costs: readonly number[] = []): ChunkPlan {
  let count = Math.min(MAX_CHUNKS, Math.max(1, Math.ceil(totalFrames / CHUNK_TARGET_FRAMES)));
  for (const rule of SPLIT) {
    while (count < rule.upTo && heaviestChunk(costs, planOf(totalFrames, count).size) > rule.whileHeaviestOverMs) {
      count += 1;
    }
  }
  return planOf(totalFrames, count);
}

export function startProgress(totalFrames: number, chunks: number = chunkPlan(totalFrames).count): RenderProgress {
  return { stage: RenderStage.Starting, chunksDone: 0, chunks, totalFrames };
}

export function advance(p: RenderProgress, event: RenderEvent): RenderProgress {
  if (FINAL.has(p.stage)) {
    return p;
  }
  const chunksDone = event.kind === 'chunk' ? Math.min(p.chunks, p.chunksDone + 1) : p.chunksDone;
  return { ...p, stage: STAGE_AFTER[event.kind], chunksDone };
}

export function framesDone(p: RenderProgress): number {
  const size = Math.ceil(p.totalFrames / p.chunks);
  return Math.min(p.totalFrames, p.chunksDone * size);
}

const STAGES = new Set<string>(Object.values(RenderStage));

export function progressOf(params: Record<string, unknown>): RenderProgress | null {
  const p = params.progress as Partial<RenderProgress> | undefined;
  if (!p || !STAGES.has(String(p.stage)) || ![p.chunksDone, p.chunks, p.totalFrames].every(Number.isFinite)) {
    return null;
  }
  return { stage: p.stage as RenderStage, chunksDone: Number(p.chunksDone), chunks: Number(p.chunks), totalFrames: Number(p.totalFrames) };
}

export const STALL_AFTER_MS = 5 * 60_000;

export enum Stall {
  None = 'none',
  Slow = 'slow',
  QueueOff = 'queue-off'
}

export type ProgressWatch = { mark: string; since: number };

const markOf = (view: RenderView) => `${view.status}:${view.progress?.stage ?? RenderStage.Starting}:${view.progress?.chunksDone ?? 0}`;

export function watchProgress(prev: ProgressWatch | null, view: RenderView, now: number): ProgressWatch {
  const mark = markOf(view);
  return prev?.mark === mark ? prev : { mark, since: now };
}

const QUEUE_STALL: Record<RenderQueue, (waitedMs: number) => Stall> = {
  [RenderQueue.Stopped]: () => Stall.QueueOff,
  [RenderQueue.Ticking]: (waitedMs) => (waitedMs >= STALL_AFTER_MS ? Stall.Slow : Stall.None)
};

export function renderStall(input: { watch: ProgressWatch; queue: RenderQueue; now: number }): Stall {
  return QUEUE_STALL[input.queue](input.now - input.watch.since);
}
