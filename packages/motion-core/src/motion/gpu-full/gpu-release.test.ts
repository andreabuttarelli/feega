import { describe, expect, it } from 'vitest';
import { loseOnDispose, releaseOnDispose, type GpuSurface } from './gpu-release';

class FakeDevice {
  destroyed = false;
  destroy() {
    this.destroyed = true;
  }
}

class FakeSurface implements GpuSurface {
  device: FakeDevice | null;
  constructor(device: FakeDevice) {
    this.device = device;
  }
  getConfiguration() {
    return this.device ? { device: this.device } : null;
  }
  unconfigure() {
    this.device = null;
  }
}

const raster = () => {
  const freed = { count: 0 };
  return { freed, raster: { draw: () => 'drawn', dispose: () => void freed.count++ } };
};

describe('a disposed raster lets go of its GPU device', () => {
  it('destroys the device it was attached with', () => {
    const device = new FakeDevice();
    const { raster: made, freed } = raster();

    releaseOnDispose(made, new FakeSurface(device)).dispose();

    expect(freed.count).toBe(1);
    expect(device.destroyed).toBe(true);
  });

  it('leaves a newer device on the same canvas alone', () => {
    const old = new FakeDevice();
    const surface = new FakeSurface(old);
    const late = releaseOnDispose(raster().raster, surface);
    const newer = new FakeDevice();
    surface.device = newer;

    late.dispose();

    expect(old.destroyed).toBe(true);
    expect(newer.destroyed).toBe(false);
    expect(surface.device).toBe(newer);
  });

  it('keeps every other raster method', () => {
    expect(releaseOnDispose(raster().raster, new FakeSurface(new FakeDevice())).draw()).toBe('drawn');
  });

  it('frees the raster when the browser cannot name its device', () => {
    const { raster: made, freed } = raster();

    releaseOnDispose(made, null).dispose();

    expect(freed.count).toBe(1);
  });
});

describe('a raster on its own canvas lets go of its GL context', () => {
  it('loses the context once the raster is disposed', () => {
    const lost = { count: 0 };
    const gl = { getExtension: () => ({ loseContext: () => void lost.count++ }) };
    const { raster: made, freed } = raster();

    const owned = loseOnDispose(made, gl);
    expect(lost.count).toBe(0);
    owned.dispose();

    expect(freed.count).toBe(1);
    expect(lost.count).toBe(1);
  });

  it('frees the raster when the canvas holds no GL context', () => {
    const { raster: made, freed } = raster();

    loseOnDispose(made, null).dispose();

    expect(freed.count).toBe(1);
  });
});
