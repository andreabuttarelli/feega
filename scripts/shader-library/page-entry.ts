import { compile, createRuntime, draw, type Compiled } from '../../packages/shader-fx/src/gl';
import { SHADER_LIBRARY } from '../../packages/shader-fx/src/library';

type Frame = { name: string; time: number; values: Record<string, number | string>; width: number; height: number; source: string | null };

const canvas = document.createElement('canvas');
const rt = createRuntime(canvas);
const programs = new Map<string, Compiled>();
const sources = new Map<string, HTMLImageElement>();

function program(name: string): Compiled {
  const cached = programs.get(name);
  if (cached) {
    return cached;
  }

  const shader = SHADER_LIBRARY.find((s) => s.name === name);
  if (!shader || !rt) {
    throw new Error(`no shader ${name}`);
  }

  const compiled = compile(rt, shader);
  if ('problems' in compiled) {
    throw new Error(compiled.problems.join('\n'));
  }

  programs.set(name, compiled);
  return compiled;
}

async function sourceOf(frame: Frame): Promise<TexImageSource> {
  if (!frame.source) {
    const blank = document.createElement('canvas');
    blank.width = frame.width;
    blank.height = frame.height;
    return blank;
  }

  const cached = sources.get(frame.source);
  if (cached) {
    return cached;
  }

  const image = new Image();
  image.src = frame.source;
  await image.decode();
  sources.set(frame.source, image);
  return image;
}

async function renderFrame(frame: Frame): Promise<string> {
  if (!rt) {
    throw new Error('WebGL is not available');
  }

  const out = draw(rt, program(frame.name), await sourceOf(frame), { time: frame.time, seed: 0, values: frame.values }) as HTMLCanvasElement;
  return out.toDataURL('image/png');
}

declare global {
  interface Window {
    renderFrame: typeof renderFrame;
  }
}

window.renderFrame = renderFrame;
