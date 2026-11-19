import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, relative } from 'node:path';
import { searchForWorkspaceRoot, type Plugin } from 'vite';
import { MAPPED_EXTENSIONS, injectSource } from './inject.ts';

const BRIDGE_PATH = fileURLToPath(new URL('./bridge.js', import.meta.url));
const VITE_CLIENT = /\/vite\/dist\/client\/client\.mjs$/;
const BRIDGE_IMPORT = `import ${JSON.stringify(`/@fs${BRIDGE_PATH}`)};`;

const isOwnSource = (id: string) => !id.includes('?') && !id.includes('/node_modules/') && !id.startsWith('\0') && MAPPED_EXTENSIONS.some((ext) => id.endsWith(ext));

export function feegaSource(): Plugin {
  let root = process.cwd();

  return {
    name: 'feega-source-map',
    apply: 'serve',
    enforce: 'pre',

    configResolved(config) {
      root = config.root;
    },

    config() {
      return { server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), dirname(BRIDGE_PATH)] } } };
    },

    async load(id) {
      if (!isOwnSource(id)) {
        return null;
      }

      const code = await readFile(id, 'utf8').catch(() => null);
      const out = code === null ? null : injectSource(code, relative(root, id));
      return out === null ? null : { code: out, map: null };
    },

    transform(code, id, options) {
      if (!VITE_CLIENT.test(id)) {
        return null;
      }
      return options?.ssr ? null : { code: `${code}\n${BRIDGE_IMPORT}\n`, map: null };
    }
  };
}
