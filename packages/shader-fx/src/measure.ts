import { compile, createRuntime, draw, read, type ShaderSource, type Uniforms } from './gl';

export type Measured = { problems: string[]; costMs: number | null; flicker: number | null };

export const CHECK_WIDTH = 1920;
export const CHECK_HEIGHT = 1080;
export const CHECK_DRAWS = 30;
const FLICKER_SIZE = 256;
const FLICKER_FPS = 30;
const FLICKER_FRAMES = 3;
const BYTE = 255;
const LUMA = [0.2126, 0.7152, 0.0722];

function testCard(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#101820');
  gradient.addColorStop(1, '#f0a050');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  return canvas;
}

function meanLuma(data: Uint8ClampedArray): number {
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += LUMA[0] * data[i] + LUMA[1] * data[i + 1] + LUMA[2] * data[i + 2];
  }
  return sum / (data.length / 4) / BYTE;
}

const defaults = (source: ShaderSource): Uniforms['values'] => Object.fromEntries(source.params.map((p) => [p.key, p.default]));

export function measure(source: ShaderSource): Measured {
  const rt = createRuntime(document.createElement('canvas'));
  if (!rt) {
    return { problems: ['WebGL is not available'], costMs: null, flicker: null };
  }

  const program = compile(rt, source);
  if ('problems' in program) {
    return { problems: program.problems, costMs: null, flicker: null };
  }

  const values = defaults(source);
  const small = testCard(FLICKER_SIZE, FLICKER_SIZE);
  const lumas = Array.from({ length: FLICKER_FRAMES }, (_, f) => {
    draw(rt, program, small, { time: f / FLICKER_FPS, seed: 0, values });
    return meanLuma(read(rt));
  });
  const flicker = Math.max(...lumas.slice(1).map((l, i) => Math.abs(l - lumas[i])));

  const card = testCard(CHECK_WIDTH, CHECK_HEIGHT);
  draw(rt, program, card, { time: 0, seed: 0, values });
  rt.gl.finish();
  const start = performance.now();
  for (let i = 0; i < CHECK_DRAWS; i++) {
    draw(rt, program, card, { time: i / FLICKER_FPS, seed: 0, values });
  }
  rt.gl.readPixels(0, 0, 1, 1, rt.gl.RGBA, rt.gl.UNSIGNED_BYTE, new Uint8Array(4));
  const costMs = (performance.now() - start) / CHECK_DRAWS;

  return { problems: [], costMs, flicker };
}
