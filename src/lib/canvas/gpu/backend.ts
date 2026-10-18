export enum Backend {
  WebGPU = 'webgpu',
  WebGL = 'webgl'
}

const FALLBACK: Record<Backend, Backend | null> = {
  [Backend.WebGPU]: Backend.WebGL,
  [Backend.WebGL]: null
};

export const nextBackend = (lost: Backend): Backend | null => FALLBACK[lost];
