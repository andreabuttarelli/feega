import { fileURLToPath } from 'node:url';
import { dirname, relative } from 'node:path';
import { searchForWorkspaceRoot, type Plugin } from 'vite';
import { injectSource } from './inject.ts';

const BRIDGE_PATH = fileURLToPath(new URL('./bridge.js', import.meta.url));
const VITE_CLIENT = /\/vite\/dist\/client\/client\.mjs$/;
const BRIDGE_IMPORT = `import ${JSON.stringify(`/@fs${BRIDGE_PATH}`)};`;

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

    transform(code, id, options) {
      if (VITE_CLIENT.test(id)) {
        return options?.ssr ? null : { code: `${code}\n${BRIDGE_IMPORT}\n`, map: null };
      }

      if (id.includes('?') || id.includes('/node_modules/') || id.startsWith('\0')) {
        return null;
      }

      const out = injectSource(code, relative(root, id));
      return out === null ? null : { code: out, map: null };
    }
  };
}
