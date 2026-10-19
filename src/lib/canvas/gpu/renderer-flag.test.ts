import { describe, expect, it } from 'vitest';
import { Backend } from './backend';
import { Renderer, Switch, backendOf, rendererOf } from './renderer-flag';

const at = (q: string) => new URL(`https://x.app/p/1/c/2${q}`);

describe('renderer flag', () => {
  it('the core canvas is the default', () => {
    expect(rendererOf(at(''), Switch.Open)).toBe(Renderer.Core);
    expect(rendererOf(at('?renderer=nonsense'), Switch.Open)).toBe(Renderer.Core);
  });

  it('?renderer=gpu, webgpu or webgl keeps the Pixi canvas as the escape hatch', () => {
    expect(rendererOf(at('?renderer=gpu'), Switch.Open)).toBe(Renderer.Gpu);
    expect(rendererOf(at('?renderer=webgl'), Switch.Open)).toBe(Renderer.Gpu);
    expect(rendererOf(at('?renderer=webgpu'), Switch.Open)).toBe(Renderer.Gpu);
  });

  it('the core kill switch sends everyone back to the Pixi canvas, ?renderer=dom still wins', () => {
    expect(rendererOf(at(''), Switch.CoreOff)).toBe(Renderer.Gpu);
    expect(rendererOf(at('?renderer=core'), Switch.CoreOff)).toBe(Renderer.Gpu);
    expect(rendererOf(at('?renderer=dom'), Switch.CoreOff)).toBe(Renderer.Dom);
  });

  it('?renderer=dom is the escape hatch', () => {
    expect(rendererOf(at('?renderer=dom'), Switch.Open)).toBe(Renderer.Dom);
  });

  it('the kill switch forces the DOM canvas for everyone', () => {
    expect(rendererOf(at(''), Switch.ForceDom)).toBe(Renderer.Dom);
    expect(rendererOf(at('?renderer=webgpu'), Switch.ForceDom)).toBe(Renderer.Dom);
  });

  it('?renderer=core names the default explicitly, the DOM kill switch still wins', () => {
    expect(rendererOf(at('?renderer=core'), Switch.Open)).toBe(Renderer.Core);
    expect(rendererOf(at('?renderer=core'), Switch.ForceDom)).toBe(Renderer.Dom);
  });

  it('webgl forces the fallback backend, anything else prefers WebGPU', () => {
    expect(backendOf(at('?renderer=webgl'))).toBe(Backend.WebGL);
    expect(backendOf(at(''))).toBe(Backend.WebGPU);
  });
});
