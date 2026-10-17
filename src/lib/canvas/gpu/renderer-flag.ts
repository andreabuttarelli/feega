import { Backend } from './backend';

export enum Renderer {
  Dom = 'dom',
  Gpu = 'gpu'
}

const PARAM = 'renderer';

const BACKEND_OF: Record<string, Backend> = {
  webgpu: Backend.WebGPU,
  webgl: Backend.WebGL
};

export const rendererOf = (url: URL): Renderer => (BACKEND_OF[url.searchParams.get(PARAM) ?? ''] ? Renderer.Gpu : Renderer.Dom);

export const backendOf = (url: URL): Backend => BACKEND_OF[url.searchParams.get(PARAM) ?? ''] ?? Backend.WebGPU;
