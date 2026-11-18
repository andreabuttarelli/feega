export enum RenderEngine {
  Html = 'html',
  GpuFull = 'gpu-full',
  GpuCore = 'gpu-core',
  GpuCoreGl = 'gpu-core-gl'
}

const PARAM = 'engine';

export const KILL_FLAG = 'motion-engine-html';

const ASKED: ReadonlySet<string> = new Set([RenderEngine.GpuFull, RenderEngine.GpuCore, RenderEngine.GpuCoreGl]);

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

export const GPU_SURFACE_MAX_SIDE = 8192;

const DRAWS_IN_STRIPS: ReadonlySet<RenderEngine> = new Set([RenderEngine.GpuCore, RenderEngine.GpuCoreGl]);

const limitedSide = (engine: RenderEngine, size: { width: number; height: number }) => (DRAWS_IN_STRIPS.has(engine) ? size.width : Math.max(size.width, size.height));

export const drawableOn = (engine: RenderEngine, size: { width: number; height: number }): RenderEngine => (limitedSide(engine, size) > GPU_SURFACE_MAX_SIDE ? RenderEngine.Html : engine);

const FALLBACK: Record<RenderEngine, RenderEngine> = {
  [RenderEngine.GpuCore]: RenderEngine.GpuCoreGl,
  [RenderEngine.GpuCoreGl]: RenderEngine.Html,
  [RenderEngine.GpuFull]: RenderEngine.Html,
  [RenderEngine.Html]: RenderEngine.Html
};

export const fallbackOf = (engine: RenderEngine): RenderEngine => FALLBACK[engine];
