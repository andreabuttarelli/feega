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
export type ServerRender = { configured: boolean; version: number; saved: boolean; latest: RenderView | null; assetHref: (id: string) => string };
export type RenderEvent = { kind: 'chunk' | 'assembling' | 'saving' | 'done' | 'failed' };

const CHUNK_TARGET_FRAMES = 120;
const MAX_CHUNKS = 8;

const FINAL: ReadonlySet<RenderStage> = new Set([RenderStage.Done, RenderStage.Failed]);

const STAGE_AFTER: Record<RenderEvent['kind'], RenderStage> = {
  chunk: RenderStage.Rendering,
  assembling: RenderStage.Assembling,
  saving: RenderStage.Saving,
  done: RenderStage.Done,
  failed: RenderStage.Failed
};

export function chunkPlan(totalFrames: number): ChunkPlan {
  const count = Math.min(MAX_CHUNKS, Math.max(1, Math.ceil(totalFrames / CHUNK_TARGET_FRAMES)));
  const size = Math.ceil(totalFrames / count);
  return { size, count: Math.ceil(totalFrames / size) };
}

export function startProgress(totalFrames: number): RenderProgress {
  return { stage: RenderStage.Starting, chunksDone: 0, chunks: chunkPlan(totalFrames).count, totalFrames };
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
