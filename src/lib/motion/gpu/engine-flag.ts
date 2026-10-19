export enum RenderEngine {
  Html = 'html',
  Gpu = 'gpu',
  GpuFull = 'gpu-full',
  GpuCore = 'gpu-core'
}

const PARAM = 'engine';

export const KILL_FLAG = 'motion-engine-html';

const ASKED: ReadonlySet<string> = new Set([RenderEngine.Gpu, RenderEngine.GpuFull, RenderEngine.GpuCore]);

export const killSwitch = (env: string | undefined, flagged: boolean): boolean => env === RenderEngine.Html || flagged;

export function engineFlag(url: URL, killed: boolean): RenderEngine {
  const asked = url.searchParams.get(PARAM) ?? '';
  return !killed && ASKED.has(asked) ? (asked as RenderEngine) : RenderEngine.Html;
}
