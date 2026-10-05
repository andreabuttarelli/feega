import { resolve } from 'node:path';
import { build } from 'esbuild';
import type { Plugin } from 'vite';

export const LIVE_RUNTIME_MODULE = 'virtual:motion-live-runtime';
const RESOLVED = `\0${LIVE_RUNTIME_MODULE}`;
const ENTRY = 'src/lib/motion/interactive/live-entry.ts';

export async function liveRuntimeSource(): Promise<{ code: string; inputs: string[] }> {
  const out = await build({ entryPoints: [ENTRY], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, metafile: true });
  return { code: out.outputFiles[0].text, inputs: Object.keys(out.metafile.inputs) };
}

export function motionLiveRuntime(): Plugin {
  return {
    name: 'motion-live-runtime',
    resolveId: (id) => (id === LIVE_RUNTIME_MODULE ? RESOLVED : null),
    async load(id) {
      if (id !== RESOLVED) {
        return null;
      }
      const { code, inputs } = await liveRuntimeSource();
      for (const file of inputs) {
        this.addWatchFile(resolve(file));
      }
      return `export default ${JSON.stringify(code)};`;
    }
  };
}
