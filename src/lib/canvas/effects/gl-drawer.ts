import { compile, createRuntime, draw, read, type Compiled, type Runtime } from '@feega/shader-fx/gl';
import type { CustomEffect, ParamValues, ShaderDrawer } from './custom';

const SEED_KIND = 'seed';

export type GlDrawer = { draw: ShaderDrawer; broken: (ref: string) => boolean };

function seedOf(effect: CustomEffect, values: ParamValues): number {
  const seed = effect.params.find((p) => p.kind === SEED_KIND);
  return seed ? Number(values[seed.key] ?? seed.default) : 0;
}

export function glDrawer(time = 0): GlDrawer {
  let runtime: Runtime | null | undefined;
  const programs = new Map<string, Compiled>();
  const failed = new Set<string>();

  const programOf = (rt: Runtime, effect: CustomEffect): Compiled => {
    const key = `${effect.id}@${effect.version}`;
    const cached = programs.get(key) ?? compile(rt, effect);
    programs.set(key, cached);
    return cached;
  };

  return {
    broken: (ref) => failed.has(ref),
    draw: (effect, pixels, values) => {
      runtime ??= createRuntime(document.createElement('canvas'));
      if (!runtime) {
        failed.add(effect.id);
        return { pixels, compiled: false };
      }

      const program = programOf(runtime, effect);
      if ('problems' in program) {
        failed.add(effect.id);
        return { pixels, compiled: false };
      }

      failed.delete(effect.id);
      const image = new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height);
      draw(runtime, program, image, { time, seed: seedOf(effect, values), values });
      return { pixels: { width: pixels.width, height: pixels.height, data: read(runtime) }, compiled: true };
    }
  };
}
