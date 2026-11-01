import type { Smoothing } from '@feega/motion-core/motion/gpu-full/text/painter';

export enum GpuBackend {
  WebGpu = 'webgpu',
  WebGl = 'webgl'
}

export type WorldItem = { doc: unknown; top: number; width: number; height: number };
export type WorldInput = { items: WorldItem[]; assets: Record<string, string>; width: number; band: number; height: number; backend: GpuBackend; smoothing: Smoothing };
export type WorldResult = { bands: string[]; skipped: string[]; unsettled: number; backend: string };
