import { fileURLToPath } from 'node:url';
import { relative } from 'node:path';
import type { Plugin } from 'vite';
import { injectSource } from './inject.ts';

const BRIDGE_PATH = fileURLToPath(new URL('./bridge.js', import.meta.url));

export function feegaSource(): Plugin {
  let root = process.cwd();

  return {
    name: 'feega-source-map',
    apply: 'serve',
    enforce: 'pre',

    configResolved(config) {
      root = config.root;
    },

    transform(code, id) {
      if (id.includes('?') || id.includes('/node_modules/') || id.startsWith('\0')) {
        return null;
      }

      const out = injectSource(code, relative(root, id));
      return out === null ? null : { code: out, map: null };
    },

    transformIndexHtml() {
      return [{ tag: 'script', attrs: { type: 'module', src: `/@fs${BRIDGE_PATH}` }, injectTo: 'head' }];
    }
  };
}
