import { Backend } from './backend';

export enum Renderer {
  Dom = 'dom',
  Gpu = 'gpu',
  Core = 'core'
}

export enum Switch {
  Open = 'open',
  ForceDom = 'force-dom'
}

const PARAM = 'renderer';

const CHOSEN: Record<string, Renderer> = {
  dom: Renderer.Dom,
  core: Renderer.Core
};

const BACKEND_OF: Record<string, Backend> = {
  webgpu: Backend.WebGPU,
  webgl: Backend.WebGL
};

export const rendererOf = (url: URL, kill: Switch): Renderer => (kill === Switch.ForceDom ? Renderer.Dom : (CHOSEN[url.searchParams.get(PARAM) ?? ''] ?? Renderer.Gpu));

export const backendOf = (url: URL): Backend => BACKEND_OF[url.searchParams.get(PARAM) ?? ''] ?? Backend.WebGPU;
