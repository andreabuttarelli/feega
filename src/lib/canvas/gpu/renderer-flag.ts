import { Backend } from './backend';

export enum Renderer {
  Gpu = 'gpu',
  Core = 'core'
}

const PARAM = 'renderer';

const CHOSEN: Record<string, Renderer> = {
  gpu: Renderer.Gpu,
  webgpu: Renderer.Gpu,
  webgl: Renderer.Gpu,
  core: Renderer.Core
};

const BACKEND_OF: Record<string, Backend> = {
  webgpu: Backend.WebGPU,
  webgl: Backend.WebGL
};

export const rendererOf = (url: URL): Renderer => CHOSEN[url.searchParams.get(PARAM) ?? ''] ?? Renderer.Core;

export const backendOf = (url: URL): Backend => BACKEND_OF[url.searchParams.get(PARAM) ?? ''] ?? Backend.WebGPU;
