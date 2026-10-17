import { describe, expect, it } from 'vitest';
import { Backend } from './backend';
import { Renderer, backendOf, rendererOf } from './renderer-flag';

const at = (q: string) => new URL(`https://x.app/p/1/c/2${q}`);

describe('renderer flag', () => {
  it('the DOM canvas stays the default', () => {
    expect(rendererOf(at(''))).toBe(Renderer.Dom);
    expect(rendererOf(at('?renderer=nonsense'))).toBe(Renderer.Dom);
  });

  it('?renderer=webgpu or webgl opts into the GPU canvas', () => {
    expect(rendererOf(at('?renderer=webgpu'))).toBe(Renderer.Gpu);
    expect(rendererOf(at('?renderer=webgl'))).toBe(Renderer.Gpu);
  });

  it('webgl forces the fallback backend, anything else prefers WebGPU', () => {
    expect(backendOf(at('?renderer=webgl'))).toBe(Backend.WebGL);
    expect(backendOf(at('?renderer=webgpu'))).toBe(Backend.WebGPU);
  });
});
