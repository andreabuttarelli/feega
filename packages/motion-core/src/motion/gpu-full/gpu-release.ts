type GpuDevice = { destroy: () => void };

export type GpuSurface = { getConfiguration?: () => { device: GpuDevice } | null; unconfigure: () => void };

export type GlSurface = { getExtension: (name: 'WEBGL_lose_context') => { loseContext: () => void } | null };

type Disposable = { dispose: () => void };

export function loseOnDispose<T extends Disposable>(raster: T, gl: GlSurface | null): T {
  if (!gl) {
    return raster;
  }

  return {
    ...raster,
    dispose: () => {
      raster.dispose();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  };
}

export function releaseOnDispose<T extends Disposable>(raster: T, surface: GpuSurface | null): T {
  const device = surface?.getConfiguration?.()?.device ?? null;
  if (!surface || !device) {
    return raster;
  }

  return {
    ...raster,
    dispose: () => {
      raster.dispose();
      if (surface.getConfiguration?.()?.device === device) {
        surface.unconfigure();
      }
      device.destroy();
    }
  };
}
