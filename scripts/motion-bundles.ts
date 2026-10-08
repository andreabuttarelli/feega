import { resolve } from 'node:path';
import { build } from 'esbuild';
import type { Plugin } from 'vite';
import { GENERATIVE_ENTRY, GENERATIVE_MODULE } from '../src/lib/motion/custom/generative';
import { TWGL_ENTRY, TWGL_MODULE } from '../src/lib/motion/custom/twgl';
import { FX_ENTRY, FX_MODULE } from '../src/lib/motion/custom/fx';
import { SPLITTING_ENTRY, SPLITTING_MODULE } from '../src/lib/motion/custom/splitting';
import { OPEN_PROPS_ENTRY, OPEN_PROPS_MODULE } from '../src/lib/motion/custom/open-props';

export const LIVE_RUNTIME_MODULE = 'virtual:motion-live-runtime';
export const LIVE_ENTRY = 'src/lib/motion/interactive/live-entry.ts';
export const SHADER_FX_MODULE = 'virtual:motion-shader-fx';
export const SHADER_FX_ENTRY = 'src/lib/motion/shaders/runtime-entry.ts';

const BUNDLES: Record<string, string> = {
  [LIVE_RUNTIME_MODULE]: LIVE_ENTRY,
  [GENERATIVE_MODULE]: GENERATIVE_ENTRY,
  [TWGL_MODULE]: TWGL_ENTRY,
  [FX_MODULE]: FX_ENTRY,
  [SPLITTING_MODULE]: SPLITTING_ENTRY,
  [OPEN_PROPS_MODULE]: OPEN_PROPS_ENTRY,
  [SHADER_FX_MODULE]: SHADER_FX_ENTRY
};

const resolved = (id: string) => `\0${id}`;

export async function bundleSource(entry: string): Promise<{ code: string; inputs: string[] }> {
  const out = await build({ entryPoints: [entry], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, metafile: true });
  return { code: out.outputFiles[0].text, inputs: Object.keys(out.metafile.inputs) };
}

export function motionBundles(): Plugin {
  const entries = new Map(Object.entries(BUNDLES).map(([id, entry]) => [resolved(id), entry]));
  return {
    name: 'motion-bundles',
    resolveId: (id) => (id in BUNDLES ? resolved(id) : null),
    async load(id) {
      const entry = entries.get(id);
      if (!entry) {
        return null;
      }
      const { code, inputs } = await bundleSource(entry);
      for (const file of inputs) {
        this.addWatchFile(resolve(file));
      }
      return `export default ${JSON.stringify(code)};`;
    }
  };
}
