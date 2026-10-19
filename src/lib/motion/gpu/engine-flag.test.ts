import { describe, expect, it } from 'vitest';
import { RenderEngine, engineFlag, killSwitch } from './engine-flag';

const url = (q = '') => new URL(`https://feega.app/app/compose/x${q}`);

describe('engineFlag', () => {
  it('draws with the HTML engine by default', () => {
    expect(engineFlag(url(), false)).toBe(RenderEngine.Html);
    expect(engineFlag(url('?engine=other'), false)).toBe(RenderEngine.Html);
    expect(engineFlag(url('?engine=html'), false)).toBe(RenderEngine.Html);
  });

  it('draws on the GPU only when the URL asks for it', () => {
    expect(engineFlag(url('?engine=gpu'), false)).toBe(RenderEngine.Gpu);
    expect(engineFlag(url('?engine=gpu-full'), false)).toBe(RenderEngine.GpuFull);
    expect(engineFlag(url('?engine=gpu-core'), false)).toBe(RenderEngine.GpuCore);
  });

  it('forces HTML for everyone when the kill switch is on', () => {
    expect(engineFlag(url('?engine=gpu'), true)).toBe(RenderEngine.Html);
    expect(engineFlag(url('?engine=gpu-full'), true)).toBe(RenderEngine.Html);
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
