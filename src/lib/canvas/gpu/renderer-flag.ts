import { Backend } from './backend';

export enum Renderer {
  Dom = 'dom',
  Gpu = 'gpu',
  Core = 'core'
}

export enum Switch {
  Open = 'open',
  ForceDom = 'force-dom',
  CoreOff = 'core-off'
}

const PARAM = 'renderer';

const CHOSEN: Record<string, Renderer> = {
  dom: Renderer.Dom,
  core: Renderer.Core,
  gpu: Renderer.Gpu,
  webgpu: Renderer.Gpu,
  webgl: Renderer.Gpu
};

const UNDER: Record<Switch, (chosen: Renderer) => Renderer> = {
  [Switch.Open]: (chosen) => chosen,
  [Switch.ForceDom]: () => Renderer.Dom,
  [Switch.CoreOff]: (chosen) => (chosen === Renderer.Core ? Renderer.Gpu : chosen)
};

const BACKEND_OF: Record<string, Backend> = {
  webgpu: Backend.WebGPU,
  webgl: Backend.WebGL
};

export const rendererOf = (url: URL, kill: Switch): Renderer => UNDER[kill](CHOSEN[url.searchParams.get(PARAM) ?? ''] ?? Renderer.Core);

export const backendOf = (url: URL): Backend => BACKEND_OF[url.searchParams.get(PARAM) ?? ''] ?? Backend.WebGPU;
