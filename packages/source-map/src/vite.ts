import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { searchForWorkspaceRoot, type Plugin } from 'vite';
import { MAPPED_EXTENSIONS, injectSource } from './inject.ts';
import { fsUrl, sourceId } from './source-id.ts';
import { PROVIDERS_QUERY } from './mount-page.ts';
import { isMountModule, mountRoutes } from './mount-routes.ts';
import { providersOf } from './providers-module.ts';

const BRIDGE_PATH = fileURLToPath(new URL('./bridge.js', import.meta.url));
const VITE_CLIENT = /\/vite\/dist\/client\/client\.mjs$/;
const MOUNT_RUNTIME_PATH = fileURLToPath(new URL('./mount-runtime.js', import.meta.url));
const PROVIDERS_SUFFIX = `?${PROVIDERS_QUERY}`;
const PASS_THROUGH = 'export function Providers({ children }) {\n  return children;\n}\n';
const BRIDGE_IMPORT = `import ${JSON.stringify(fsUrl(BRIDGE_PATH))};`;

const isOwnSource = (id: string) => !id.includes('?') && !id.includes('/node_modules/') && !id.startsWith('\0') && MAPPED_EXTENSIONS.some((ext) => id.endsWith(ext));

export enum Bridge {
  ViteClient = 'vite-client',
  Proxy = 'proxy'
}

export type SourceOptions = { bridge?: Bridge; root?: string };

export function feegaSource({ bridge = Bridge.ViteClient, root: projectRoot }: SourceOptions = {}): Plugin {
  let root = process.cwd();
  let mount: ReturnType<typeof mountRoutes> | null = null;

  return {
    name: 'feega-source-map',
    apply: 'serve',
    enforce: 'pre',

    configResolved(config) {
      root = projectRoot ?? config.root;
    },

    config() {
      return { server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), dirname(BRIDGE_PATH)] } } };
    },

    configureServer(server) {
      mount = mountRoutes(server, { root: () => root, runtimePath: MOUNT_RUNTIME_PATH });
    },

    resolveId(source) {
      if (isMountModule(source)) {
        return source;
      }
      return source.endsWith(PROVIDERS_SUFFIX) ? join(root, source.slice(0, -PROVIDERS_SUFFIX.length)) + PROVIDERS_SUFFIX : null;
    },

    async load(id) {
      if (isMountModule(id)) {
        return mount?.moduleFor(id) ?? null;
      }
      if (id.endsWith(PROVIDERS_SUFFIX)) {
        const code = await readFile(id.slice(0, -PROVIDERS_SUFFIX.length), 'utf8').catch(() => null);
        return (code && providersOf(code)) ?? PASS_THROUGH;
      }
      if (!isOwnSource(id)) {
        return null;
      }

      const code = await readFile(id, 'utf8').catch(() => null);
      const out = code === null ? null : injectSource(code, sourceId(root, id));
      return out === null ? null : { code: out, map: null };
    },

    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        return injectSource(html, sourceId(root, ctx.filename)) ?? html;
      }
    },

    transform(code, id, options) {
      if (bridge === Bridge.Proxy || !VITE_CLIENT.test(id)) {
        return null;
      }
      return options?.ssr ? null : { code: `${code}\n${BRIDGE_IMPORT}\n`, map: null };
    }
  };
}
