import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import type { Plugin } from 'vite';

export const CHANGELOG_ENTRIES_MODULE = 'virtual:changelog-entries';
export const CHANGELOG_DIR = 'src/lib/content/changelog';

const ENTRY_FILE = /^2.*\.ts$/;
const TEST_FILE = /\.test\.ts$/;

const resolvedId = `\0${CHANGELOG_ENTRIES_MODULE}`;

export function entryFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => ENTRY_FILE.test(name) && !TEST_FILE.test(name))
    .sort((a, b) => b.localeCompare(a))
    .map((name) => resolve(dir, name));
}

export async function bundleEntries(dir: string): Promise<{ code: string; inputs: string[] }> {
  const files = entryFiles(dir);
  const imports = files.map((file, i) => `import e${i} from ${JSON.stringify(file)};`);
  const list = files.map((_, i) => `e${i}`).join(',');
  const out = await build({
    stdin: { contents: `${imports.join('\n')}\nexport default [${list}];`, resolveDir: dir, loader: 'ts' },
    bundle: true,
    format: 'esm',
    target: 'es2022',
    write: false,
    minify: true
  });
  return { code: out.outputFiles[0].text, inputs: files };
}

export function changelogEntries(): Plugin {
  return {
    name: 'changelog-entries',
    resolveId: (id) => (id === CHANGELOG_ENTRIES_MODULE ? resolvedId : null),
    async load(id) {
      if (id !== resolvedId) {
        return null;
      }
      const { code, inputs } = await bundleEntries(join(process.cwd(), CHANGELOG_DIR));
      for (const file of inputs) {
        this.addWatchFile(file);
      }
      return code;
    }
  };
}
