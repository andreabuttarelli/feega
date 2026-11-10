import { StartupStep } from './startup-marks';

export enum CanvasContent {
  Frames = 'frames',
  Empty = 'empty'
}

const READY: Record<CanvasContent, StartupStep> = {
  [CanvasContent.Frames]: StartupStep.FirstDrawn,
  [CanvasContent.Empty]: StartupStep.Mounted
};

const WEIGHT: Partial<Record<StartupStep, number>> = {
  [StartupStep.PageData]: 0.15,
  [StartupStep.RendererChunk]: 0.1,
  [StartupStep.WasmReady]: 0.1,
  [StartupStep.GpuReady]: 0.1,
  [StartupStep.SourcesArrived]: 0.3,
  [StartupStep.FirstBuilt]: 0.15
};


export function startupProgress(done: ReadonlySet<StartupStep>, content = CanvasContent.Frames): number {
  if (done.has(READY[content])) {
    return 1;
  }
  return [...done].reduce((sum, step) => sum + (WEIGHT[step] ?? 0), 0);
}
