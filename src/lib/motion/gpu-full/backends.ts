import { createCore, createCoreGl } from './core-web';
import { createRaster, type Raster } from './raster';

export enum FullBackend {
  WebGl2 = 'webgl2',
  Core = 'core',
  CoreGl = 'core-gl'
}

export const BACKENDS: Record<FullBackend, (canvas: HTMLCanvasElement, width: number, height: number) => Promise<Raster>> = {
  [FullBackend.WebGl2]: async (canvas, width, height) => createRaster(canvas, width, height),
  [FullBackend.Core]: createCore,
  [FullBackend.CoreGl]: createCoreGl
};
