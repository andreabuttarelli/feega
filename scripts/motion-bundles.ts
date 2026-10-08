import { resolve } from 'node:path';
import { build } from 'esbuild';
import type { Plugin } from 'vite';

export const LIVE_RUNTIME_MODULE = 'virtual:motion-live-runtime';
export const LIVE_ENTRY = 'src/lib/motion/interactive/live-entry.ts';

const BUNDLES: Record<string, string> = {
  [LIVE_RUNTIME_MODULE]: LIVE_ENTRY
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
