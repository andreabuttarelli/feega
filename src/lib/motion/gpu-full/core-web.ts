import type { DisplayList } from './display-list';
import type { Raster } from './raster';

const CORE_URL = '/gpu-core/gpu_core.js';

type CoreModule = { default: () => Promise<unknown>; WebCore: { attach: (canvas: HTMLCanvasElement, width: number, height: number) => Promise<{ draw: (list: string) => string; free: () => void }> } };

export async function createCore(canvas: HTMLCanvasElement, width: number, height: number): Promise<Raster> {
  if (!('gpu' in navigator)) {
    throw new Error('webgpu unavailable');
  }
  const core = (await import(/* @vite-ignore */ CORE_URL)) as CoreModule;
  await core.default();
  const attached = await core.WebCore.attach(canvas, width, height);
  return {
    draw: (list: DisplayList) => {
      attached.draw(JSON.stringify(list));
    },
    dispose: () => attached.free()
  };
}
