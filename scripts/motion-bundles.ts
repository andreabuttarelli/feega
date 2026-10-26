import { resolve } from 'node:path';
import { build, type Plugin as EsbuildPlugin } from 'esbuild';
import type { Plugin } from 'vite';
import { GENERATIVE_ENTRY, GENERATIVE_MODULE } from '../packages/motion-core/src/motion/custom/generative';
import { TWGL_ENTRY, TWGL_MODULE } from '../packages/motion-core/src/motion/custom/twgl';
import { FX_ENTRY, FX_MODULE } from '../packages/motion-core/src/motion/custom/fx';
import { SPLITTING_ENTRY, SPLITTING_MODULE } from '../packages/motion-core/src/motion/custom/splitting';
import { OPEN_PROPS_ENTRY, OPEN_PROPS_MODULE } from '../packages/motion-core/src/motion/custom/open-props';

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

export const PLAYER_MODULE = 'virtual:motion-player';
export const PLAYER_ENTRY = 'packages/motion-core/src/motion/gpu-full/player-entry.ts';

const resolved = (id: string) => `\0${id}`;

type VirtualLoader = (id: string) => Promise<string>;

const VIRTUAL = 'virtual';

const viteVirtuals = (load: VirtualLoader): EsbuildPlugin => ({
  name: 'vite-virtuals',
  setup(b) {
    b.onResolve({ filter: /^virtual:/ }, (a) => ({ path: a.path, namespace: VIRTUAL }));
    b.onLoad({ filter: /.*/, namespace: VIRTUAL }, async (a) => ({ contents: await load(a.path), loader: 'js' }));
  }
});

export async function bundlePlayer(load: VirtualLoader): Promise<{ code: string; inputs: string[] }> {
  const out = await build({ entryPoints: [PLAYER_ENTRY], bundle: true, minify: true, format: 'esm', target: 'es2022', write: false, metafile: true, plugins: [viteVirtuals(load)] });
  return { code: out.outputFiles[0].text, inputs: Object.keys(out.metafile.inputs).filter((f) => !f.startsWith(`${VIRTUAL}:`)) };
}

export async function bundleSource(entry: string): Promise<{ code: string; inputs: string[] }> {
  const out = await build({ entryPoints: [entry], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, metafile: true });
  return { code: out.outputFiles[0].text, inputs: Object.keys(out.metafile.inputs) };
}

export function motionBundles(others: (id: string) => Promise<string | null> = async () => null): Plugin {
  const entries = new Map(Object.entries(BUNDLES).map(([id, entry]) => [resolved(id), entry]));
  return {
    name: 'motion-bundles',
    resolveId: (id) => (id in BUNDLES || id === PLAYER_MODULE ? resolved(id) : null),
    async load(id) {
      if (id === resolved(PLAYER_MODULE)) {
        const virtualCode: VirtualLoader = async (name) => (name in BUNDLES ? `export default ${JSON.stringify((await bundleSource(BUNDLES[name])).code)};` : ((await others(name)) ?? ''));
        const { code, inputs } = await bundlePlayer(virtualCode);
        for (const file of inputs) {
          this.addWatchFile(resolve(file));
        }
        return `export default ${JSON.stringify(code)};`;
      }
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
