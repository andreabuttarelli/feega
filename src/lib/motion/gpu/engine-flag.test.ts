import { describe, expect, it } from 'vitest';
import { RenderEngine, engineFlag, killSwitch } from './engine-flag';

const url = (q = '') => new URL(`https://feega.app/app/compose/x${q}`);

describe('engineFlag', () => {
  it('draws with the GPU core by default', () => {
    expect(engineFlag(url(), false)).toBe(RenderEngine.GpuCore);
    expect(engineFlag(url('?engine=other'), false)).toBe(RenderEngine.GpuCore);
  });

  it('?engine=html returns to the HTML engine', () => {
    expect(engineFlag(url('?engine=html'), false)).toBe(RenderEngine.Html);
  });

  it('honours an explicit engine in the URL', () => {
    expect(engineFlag(url('?engine=gpu'), false)).toBe(RenderEngine.Gpu);
    expect(engineFlag(url('?engine=gpu-full'), false)).toBe(RenderEngine.GpuFull);
    expect(engineFlag(url('?engine=gpu-core'), false)).toBe(RenderEngine.GpuCore);
    expect(engineFlag(url('?engine=gpu-core-gl'), false)).toBe(RenderEngine.GpuCoreGl);
  });

  it('forces HTML for everyone when the kill switch is on', () => {
    expect(engineFlag(url('?engine=gpu'), true)).toBe(RenderEngine.Html);
    expect(engineFlag(url('?engine=gpu-full'), true)).toBe(RenderEngine.Html);
    expect(engineFlag(url(), true)).toBe(RenderEngine.Html);
  });
});

describe('killSwitch', () => {
  it('trips on the env value or the PostHog flag', () => {
    expect(killSwitch('html', false)).toBe(true);
    expect(killSwitch(undefined, true)).toBe(true);
    expect(killSwitch(undefined, false)).toBe(false);
    expect(killSwitch('gpu', false)).toBe(false);
  });
});
