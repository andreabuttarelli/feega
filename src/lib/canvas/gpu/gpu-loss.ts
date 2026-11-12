export enum GpuBackend {
  Native = 'native',
  WebGpu = 'webgpu',
  WebGl = 'webgl'
}

export const GPU_FALLBACK_EVENT = 'gpu_backend_fallback';

export type BackendSwitch = { from: GpuBackend; to: GpuBackend; why: string };

export const LOSSES_PER_BACKEND = 3;

export const FRESH_CORES = 2;

export const backendAfterLoss = (backend: number, losses: number, backends: number): number => (losses >= LOSSES_PER_BACKEND && backend + 1 < backends ? backend + 1 : backend);

export enum AttachStep {
  FreshCore = 'fresh-core',
  NextBackend = 'next-backend',
  GiveUp = 'give-up'
}

export const isTrap = (e: unknown): boolean => typeof WebAssembly !== 'undefined' && e instanceof WebAssembly.RuntimeError;

export function afterAttachFailure(e: unknown, backend: number, freshCores: number, backends: number): { step: AttachStep; backend: number } {
  if (isTrap(e) && freshCores < FRESH_CORES) {
    return { step: AttachStep.FreshCore, backend };
  }
  if (backend + 1 < backends) {
    return { step: AttachStep.NextBackend, backend: backend + 1 };
  }
  return { step: AttachStep.GiveUp, backend };
}
