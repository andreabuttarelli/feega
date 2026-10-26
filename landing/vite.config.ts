import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sveltekit } from '@sveltejs/kit/vite';
import { build } from 'esbuild';
import { defineConfig, type Plugin } from 'vite';

const CHANGELOG_MODULE = 'virtual:changelog-entries';
const CHANGELOG_DIR = resolve(import.meta.dirname, '../src/lib/content/changelog');
const ENTRY_FILE = /^2.*\.ts$/;
const TEST_FILE = /\.test\.ts$/;

function entryFiles(): string[] {
  return readdirSync(CHANGELOG_DIR)
    .filter((name) => ENTRY_FILE.test(name) && !TEST_FILE.test(name))
    .sort((a, b) => b.localeCompare(a))
    .map((name) => resolve(CHANGELOG_DIR, name));
}

function changelogEntries(): Plugin {
  const resolvedId = `\0${CHANGELOG_MODULE}`;
  return {
    name: 'changelog-entries',
    resolveId: (id) => (id === CHANGELOG_MODULE ? resolvedId : null),
    async load(id) {
      if (id !== resolvedId) {
        return null;
      }

      const files = entryFiles();
      const imports = files.map((file, i) => `import e${i} from ${JSON.stringify(file)};`);
      const contents = `${imports.join('\n')}\nimport legacy from './legacy';\nexport default [${files.map((_, i) => `e${i}`).join(',')}, ...legacy];`;
      const out = await build({
        stdin: { contents, resolveDir: CHANGELOG_DIR, loader: 'ts' },
        tsconfigRaw: {},
        bundle: true,
        format: 'esm',
        write: false
      });
      files.forEach((file) => this.addWatchFile(file));
      return out.outputFiles[0].text;
    }
  };
}

export default defineConfig({
  plugins: [sveltekit(), changelogEntries()],
  server: { fs: { allow: [CHANGELOG_DIR] } }
});
