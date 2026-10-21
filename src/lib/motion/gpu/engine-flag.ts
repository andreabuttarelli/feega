export enum RenderEngine {
  Html = 'html',
  Gpu = 'gpu',
  GpuFull = 'gpu-full',
  GpuCore = 'gpu-core',
  GpuCoreGl = 'gpu-core-gl'
}

const PARAM = 'engine';

export const KILL_FLAG = 'motion-engine-html';

const ASKED: ReadonlySet<string> = new Set([RenderEngine.Gpu, RenderEngine.GpuFull, RenderEngine.GpuCore, RenderEngine.GpuCoreGl]);

export const killSwitch = (env: string | undefined, flagged: boolean): boolean => env === RenderEngine.Html || flagged;

const DEFAULT_ENGINE = RenderEngine.GpuCore;

export function engineFlag(url: URL, killed: boolean): RenderEngine {
  if (killed) {
    return RenderEngine.Html;
  }
  const asked = url.searchParams.get(PARAM) ?? '';
  if (asked === RenderEngine.Html) {
    return RenderEngine.Html;
  }
  return ASKED.has(asked) ? (asked as RenderEngine) : DEFAULT_ENGINE;
}
