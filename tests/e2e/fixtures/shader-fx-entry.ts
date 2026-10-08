import { compile, createRuntime, draw, drawEffect, read } from '../../../packages/shader-fx/src/gl';
import { measure } from '../../../packages/shader-fx/src/measure';

const SIZE = 64;
const HD_WIDTH = 1920;
const HD_HEIGHT = 1080;

function source(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      ctx.fillStyle = `rgb(${x * 4}, ${y * 4}, ${(x * y) % 256})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

function bytes(canvas: HTMLCanvasElement | OffscreenCanvas): Uint8ClampedArray {
  const out = document.createElement('canvas');
  out.width = SIZE;
  out.height = SIZE;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(canvas as CanvasImageSource, 0, 0);
  return ctx.getImageData(0, 0, SIZE, SIZE).data;
}

const equal = (a: Uint8ClampedArray, b: Uint8ClampedArray) => a.length === b.length && a.every((v, i) => v === b[i]);

function runtime() {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  return createRuntime(canvas)!;
}

const uniforms = (time = 0) => ({ time, seed: 7, values: {} });

function hash(data: Uint8ClampedArray): string {
  let h = 2166136261;
  for (const v of data) {
    h = Math.imul(h ^ v, 16777619);
  }
  return (h >>> 0).toString(16);
}

function hd(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = HD_WIDTH;
  canvas.height = HD_HEIGHT;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, HD_WIDTH, HD_HEIGHT);
  gradient.addColorStop(0, '#102030');
  gradient.addColorStop(1, '#f0a050');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, HD_WIDTH, HD_HEIGHT);
  return canvas;
}

const probe = {
  measure: (frag: string) => measure({ frag, params: [] }),
  costMs: (frag: string, draws: number) => {
    const rt = runtime();
    const src = hd();
    const compiled = compile(rt, { frag, params: [] });
    draw(rt, compiled, src, uniforms());
    rt.gl.finish();
    const start = performance.now();
    for (let i = 0; i < draws; i++) {
      draw(rt, compiled, src, uniforms(i / 30));
    }
    rt.gl.readPixels(0, 0, 1, 1, rt.gl.RGBA, rt.gl.UNSIGNED_BYTE, new Uint8Array(4));
    return { ms: (performance.now() - start) / draws, renderer: String(rt.gl.getParameter(rt.gl.RENDERER)) };
  },
  problemsOf: (frag: string) => {
    const compiled = compile(runtime(), { frag, params: [] });
    return 'problems' in compiled ? compiled.problems : [];
  },
  readMatches: () => {
    const src = source();
    const rt = runtime();
    const image = src.getContext('2d')!.getImageData(0, 0, SIZE, SIZE);
    draw(rt, null, image, uniforms());
    return equal(read(rt), image.data);
  },
  passthroughMatches: () => {
    const src = source();
    return equal(bytes(draw(runtime(), null, src, uniforms())), bytes(src));
  },
  brokenMatches: () => {
    const src = source();
    return equal(bytes(drawEffect(runtime(), { frag: 'vec4 effect(vec2 uv) { return nope; }', params: [] }, src, uniforms()).canvas), bytes(src));
  },
  changes: (frag: string) => {
    const src = source();
    return !equal(bytes(drawEffect(runtime(), { frag, params: [] }, src, uniforms()).canvas), bytes(src));
  },
  hashes: (frag: string, times: number[]) => {
    const src = source();
    return times.map((t) => hash(bytes(drawEffect(runtime(), { frag, params: [] }, src, uniforms(t)).canvas)));
  }
};

declare global {
  interface Window {
    shaderFxProbe: typeof probe;
  }
}

window.shaderFxProbe = probe;
