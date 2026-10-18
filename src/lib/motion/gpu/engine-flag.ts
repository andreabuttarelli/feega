export enum RenderEngine {
  Html = 'html',
  Gpu = 'gpu'
}

const PARAM = 'engine';

export const KILL_FLAG = 'motion-engine-html';

export const killSwitch = (env: string | undefined, flagged: boolean): boolean => env === RenderEngine.Html || flagged;

export const engineFlag = (url: URL, killed: boolean): RenderEngine => (killed || url.searchParams.get(PARAM) === RenderEngine.Html ? RenderEngine.Html : RenderEngine.Gpu);
