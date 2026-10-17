export enum RenderEngine {
  Html = 'html',
  Gpu = 'gpu'
}

const PARAM = 'engine';

export const engineFlag = (url: URL): RenderEngine => (url.searchParams.get(PARAM) === RenderEngine.Gpu ? RenderEngine.Gpu : RenderEngine.Html);
