import { describe, expect, it } from 'vitest';
import { Backend } from './backend';
import { Renderer, backendOf, rendererOf } from './renderer-flag';

const at = (q: string) => new URL(`https://x.app/p/1/c/2${q}`);

describe('renderer flag', () => {
  it('the core canvas is the default', () => {
    expect(rendererOf(at(''))).toBe(Renderer.Core);
    expect(rendererOf(at('?renderer=nonsense'))).toBe(Renderer.Core);
    expect(rendererOf(at('?renderer=core'))).toBe(Renderer.Core);
  });

  it('?renderer=dom no longer exists: it opens the core canvas', () => {
    expect(rendererOf(at('?renderer=dom'))).toBe(Renderer.Core);
  });

  it('?renderer=gpu, webgpu or webgl returns to the PixiJS canvas', () => {
    expect(rendererOf(at('?renderer=gpu'))).toBe(Renderer.Gpu);
    expect(rendererOf(at('?renderer=webgpu'))).toBe(Renderer.Gpu);
    expect(rendererOf(at('?renderer=webgl'))).toBe(Renderer.Gpu);
  });

  it('webgl forces the fallback backend, anything else prefers WebGPU', () => {
    expect(backendOf(at('?renderer=webgl'))).toBe(Backend.WebGL);
    expect(backendOf(at(''))).toBe(Backend.WebGPU);
  });
});
