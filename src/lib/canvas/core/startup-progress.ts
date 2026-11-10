import { StartupStep } from './startup-marks';

export enum CanvasContent {
  Frames = 'frames',
  Empty = 'empty'
}

export type FramesShown = { shown: number; total: number };

const READY: Record<CanvasContent, StartupStep> = {
  [CanvasContent.Frames]: StartupStep.AllShown,
  [CanvasContent.Empty]: StartupStep.Mounted
};

const WEIGHT: Partial<Record<StartupStep, number>> = {
  [StartupStep.PageData]: 0.1,
  [StartupStep.RendererChunk]: 0.05,
  [StartupStep.WasmReady]: 0.05,
  [StartupStep.GpuReady]: 0.05,
  [StartupStep.SourcesArrived]: 0.15,
  [StartupStep.FirstBuilt]: 0.1
};

const FRAMES_WEIGHT = 0.5;

export function startupProgress(done: ReadonlySet<StartupStep>, frames: FramesShown, content = CanvasContent.Frames): number {
  if (done.has(READY[content])) {
    return 1;
  }
  const steps = [...done].reduce((sum, step) => sum + (WEIGHT[step] ?? 0), 0);
  const shown = frames.total ? (frames.shown / frames.total) * FRAMES_WEIGHT : 0;
  return Math.min(steps + shown, 0.99);
}

const REVEAL_AFTER_ENGINE_MS = 8_000;
const REVEAL_HARD_MS = 12_000;

export function revealDue(at: { sinceStartMs: number; sinceEngineMs: number | null }): boolean {
  return at.sinceStartMs >= REVEAL_HARD_MS || (at.sinceEngineMs !== null && at.sinceEngineMs >= REVEAL_AFTER_ENGINE_MS);
}
