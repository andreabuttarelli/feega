import { fileURLToPath } from 'node:url';

const LOADER_PATH = fileURLToPath(new URL('./next-loader.ts', import.meta.url));
const BRIDGE_PATH = fileURLToPath(new URL('./bridge.js', import.meta.url));
const CLIENT_ENTRIES = ['main-app', 'main'];

type EntryValue = string | string[] | { import: string[] };
type Entries = Record<string, EntryValue>;
type WebpackConfig = { entry: () => Promise<Entries>; module: { rules: unknown[] } };
type WebpackContext = { dev: boolean; isServer: boolean; dir: string };
type NextConfig = { webpack?: (config: WebpackConfig, context: WebpackContext) => WebpackConfig; [key: string]: unknown };

export function withFeegaSource<T extends NextConfig>(nextConfig: T = {} as T): T {
  return {
    ...nextConfig,
    webpack(config: WebpackConfig, context: WebpackContext) {
      const out = nextConfig.webpack ? nextConfig.webpack(config, context) : config;
      if (!context.dev) {
        return out;
      }

      out.module.rules.push({
        test: /\.(jsx|tsx)$/,
        exclude: /node_modules/,
        enforce: 'pre',
        use: [{ loader: LOADER_PATH, options: { root: context.dir } }]
      });

      if (!context.isServer) {
        out.entry = withBridge(out.entry);
      }
      return out;
    }
  };
}

function withBridge(entry: () => Promise<Entries>): () => Promise<Entries> {
  return async () => {
    const entries = await entry();
    for (const name of CLIENT_ENTRIES) {
      if (entries[name]) {
        entries[name] = prepend(entries[name]);
      }
    }
    return entries;
  };
}

function prepend(value: EntryValue): EntryValue {
  if (typeof value === 'string') {
    return [BRIDGE_PATH, value];
  }
  if (Array.isArray(value)) {
    return value.includes(BRIDGE_PATH) ? value : [BRIDGE_PATH, ...value];
  }
  return { ...value, import: prepend(value.import) as string[] };
}
