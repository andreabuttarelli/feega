import { APP_URL } from '../links';
import type { PixelIcon } from '../alternatives/pixel';
import { DEFAULT_COPY, FALLBACK_PLUGINS, PLUGIN_COPY, type PluginSource, type PluginTier } from './fallback';
import { permissionWords } from './permissions';

export const PLUGINS_PATH = '/plugins';

const API_URL = `${APP_URL}/api/v1/plugins`;
const FETCH_TIMEOUT_MS = 5000;

export type PluginStats = { installs: number; activeInstalls: number; upvotes: number };

export type PluginView = {
  id: string;
  name: string;
  summary: string;
  description: string;
  author: string;
  tier: PluginTier;
  version: string;
  permissions: string[];
  icon: PixelIcon;
  stats: PluginStats | null;
};

type ApiPlugin = {
  id: string;
  name: string;
  summary: string;
  author: string;
  tier: PluginTier;
  latestVersion: string;
  manifest: { permissions?: string[] };
  installs: number;
  activeInstalls: number;
  upvotes: number;
};

export const pluginPath = (id: string): string => `${PLUGINS_PATH}/${id}`;

function view(source: PluginSource, stats: PluginStats | null): PluginView {
  const copy = PLUGIN_COPY[source.id] ?? DEFAULT_COPY;

  return {
    id: source.id,
    name: source.name,
    summary: source.summary,
    description: copy.description || source.summary,
    author: source.author,
    tier: source.tier,
    version: source.latestVersion,
    permissions: source.permissions.map(permissionWords),
    icon: copy.icon,
    stats
  };
}

function fromApi(plugin: ApiPlugin): PluginView {
  const { installs, activeInstalls, upvotes } = plugin;

  return view({ ...plugin, permissions: plugin.manifest?.permissions ?? [] }, { installs, activeInstalls, upvotes });
}

const fallback = (): PluginView[] => FALLBACK_PLUGINS.map((source) => view(source, null));

export async function loadPlugins(fetcher: typeof fetch): Promise<PluginView[]> {
  try {
    const res = await fetcher(API_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) {
      return fallback();
    }

    const body = (await res.json()) as { plugins?: ApiPlugin[] };
    if (!Array.isArray(body.plugins) || !body.plugins.length) {
      return fallback();
    }

    return body.plugins.map(fromApi);
  } catch {
    return fallback();
  }
}
