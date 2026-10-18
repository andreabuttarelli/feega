import { Backend } from './backend';

export enum Renderer {
  Dom = 'dom',
  Gpu = 'gpu'
}

export enum Switch {
  Open = 'open',
  ForceDom = 'force-dom'
}

const PARAM = 'renderer';
const DOM = 'dom';

const BACKEND_OF: Record<string, Backend> = {
  webgpu: Backend.WebGPU,
  webgl: Backend.WebGL
};

export const rendererOf = (url: URL, kill: Switch): Renderer => (kill === Switch.ForceDom || url.searchParams.get(PARAM) === DOM ? Renderer.Dom : Renderer.Gpu);

export const backendOf = (url: URL): Backend => BACKEND_OF[url.searchParams.get(PARAM) ?? ''] ?? Backend.WebGPU;
