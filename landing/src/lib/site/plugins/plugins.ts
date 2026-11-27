import { PixelIcon } from '../alternatives/pixel';
import { COPY, SOURCES, type PluginShot, type PluginTier } from '../../../../../packages/plugin-registry/src/registry';
import { permissionWords } from './permissions';

export const PLUGINS_PATH = '/plugins';

export type { PluginShot, PluginTier };

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
  shots: readonly PluginShot[];
  cover: PluginShot;
};

export const pluginPath = (id: string): string => `${PLUGINS_PATH}/${id}`;

export const PLUGINS: readonly PluginView[] = SOURCES.map((source) => ({
  id: source.id,
  name: source.name,
  summary: source.summary,
  description: COPY[source.id].description,
  author: source.author,
  tier: source.tier,
  version: source.latestVersion,
  permissions: source.permissions.map(permissionWords),
  icon: COPY[source.id].icon as PixelIcon,
  shots: COPY[source.id].shots,
  cover: COPY[source.id].shots[COPY[source.id].coverIndex]
}));
