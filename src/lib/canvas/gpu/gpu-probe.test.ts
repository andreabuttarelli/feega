import { describe, expect, it } from 'vitest';
import { pollLag, probeGpu, type GpuApi } from './gpu-probe';

type Texture = { destroy: () => void };

function fakeGpu() {
  class Device {
    createTexture(_d: { size: { width: number; height?: number } | number[]; format: string }): Texture {
      return Object.create(Texture.prototype) as Texture;
    }
  }
  class Texture {
    destroy() {}
  }
  class Queue {
    submit(_b: unknown) {}
    onSubmittedWorkDone() {
      return Promise.resolve();
    }
  }
  return { GPUDevice: Device, GPUTexture: Texture, GPUQueue: Queue } as unknown as GpuApi & { GPUDevice: typeof Device; GPUQueue: typeof Queue };
}

describe('the GPU probe', () => {
  it('counts live texture bytes and textures, and forgets destroyed ones', () => {
    const api = fakeGpu();
    const gpu = probeGpu(api);
    const device = new api.GPUDevice();

    const a = device.createTexture({ size: { width: 100, height: 50 }, format: 'rgba8unorm' });
    device.createTexture({ size: [10, 10], format: 'rgba16float' });
    a.destroy();
    a.destroy();

    expect(gpu.textures).toBe(1);
    expect(gpu.textureBytes).toBe(10 * 10 * 8);
    expect(gpu.created).toBe(2);
  });

  it('counts submits', () => {
    const api = fakeGpu();
    const gpu = probeGpu(api);
    const queue = new api.GPUQueue();

    queue.submit([]);
    queue.submit([]);

    expect(gpu.submits).toBe(2);
  });

  it('measures the lag as the time the queue takes to finish what was submitted', async () => {
    const api = fakeGpu();
    const gpu = probeGpu(api);
    new api.GPUQueue().submit([]);
    let now = 100;

    pollLag(gpu, () => now);
    now = 140;
    await Promise.resolve();
    await Promise.resolve();

    expect(gpu.lagMs).toBe(40);
  });

  it('patches the prototypes once', () => {
    const api = fakeGpu();
    probeGpu(api);
    const again = probeGpu(api);
    new api.GPUDevice().createTexture({ size: [1, 1], format: 'rgba8unorm' });

    expect(again.created).toBe(1);
  });
});
