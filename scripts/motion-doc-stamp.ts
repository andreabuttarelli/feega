import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import type { Plugin } from 'vite';

export const MOTION_DOC_STAMP_MODULE = 'virtual:motion-doc-stamp';
export const DOC_ENTRY = resolve(import.meta.dirname, '../packages/motion-core/src/motion/doc.ts');

const STAMP_LENGTH = 16;
const resolvedId = `\0${MOTION_DOC_STAMP_MODULE}`;

export async function docStamp(entry: string): Promise<{ stamp: string; inputs: string[] }> {
  const out = await build({
    stdin: { contents: `export { parseMotionDoc } from ${JSON.stringify(entry)};`, resolveDir: resolve(entry, '..'), loader: 'ts' },
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    mainFields: ['module', 'main'],
    target: 'es2022',
    write: false,
    minifyWhitespace: true,
    minifySyntax: true,
    metafile: true,
    logLevel: 'silent'
  });
  const stamp = createHash('sha256').update(out.outputFiles[0].text).digest('hex').slice(0, STAMP_LENGTH);
  return { stamp, inputs: Object.keys(out.metafile.inputs).filter((f) => !f.startsWith('<')).map((f) => resolve(f)) };
}

export function motionDocStamp(): Plugin {
  return {
    name: 'motion-doc-stamp',
    resolveId: (id) => (id === MOTION_DOC_STAMP_MODULE ? resolvedId : null),
    async load(id) {
      if (id !== resolvedId) {
        return null;
      }
      const { stamp, inputs } = await docStamp(DOC_ENTRY);
      for (const file of inputs) {
        this.addWatchFile(file);
      }
      return `export default ${JSON.stringify(stamp)};`;
    }
  };
}
