import { compile, createRuntime, draw, type Compiled } from '../../packages/shader-fx/src/gl';
import { measure } from '../../packages/shader-fx/src/measure';
import { SHADER_LIBRARY } from '../../packages/shader-fx/src/library';

type Frame = { name: string; time: number; values: Record<string, number | string>; width: number; height: number };

const canvas = document.createElement('canvas');
const rt = createRuntime(canvas);
const programs = new Map<string, Compiled>();

function shaderOf(name: string) {
  const shader = SHADER_LIBRARY.find((s) => s.name === name);
  if (!shader) {
    throw new Error(`no shader ${name}`);
  }

  return shader;
}

function program(name: string): Compiled {
  const cached = programs.get(name);
  if (cached) {
    return cached;
  }

  if (!rt) {
    throw new Error('WebGL is not available');
  }

  const compiled = compile(rt, shaderOf(name));
  if ('problems' in compiled) {
    throw new Error(compiled.problems.join('\n'));
  }

  programs.set(name, compiled);
  return compiled;
}

function renderFrame(frame: Frame): string {
  if (!rt) {
    throw new Error('WebGL is not available');
  }

  const blank = document.createElement('canvas');
  blank.width = frame.width;
  blank.height = frame.height;
  const out = draw(rt, program(frame.name), blank, { time: frame.time, seed: 0, values: frame.values }) as HTMLCanvasElement;
  return out.toDataURL('image/png');
}

function costMs(name: string): number {
  return measure(shaderOf(name)).costMs ?? Number.NaN;
}

declare global {
  interface Window {
    renderFrame: typeof renderFrame;
    costMs: typeof costMs;
  }
}

window.renderFrame = renderFrame;
window.costMs = costMs;
