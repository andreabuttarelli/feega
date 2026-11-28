import { PixelIcon } from '../alternatives/pixel';
import { COPY, SOURCES, creditLine, labelsOf, type PluginCredit, type PluginLabel, type PluginTier } from '../../../../../packages/plugin-registry/src/registry';
import { permissionWords } from './permissions';

export const PLUGINS_PATH = '/plugins';

export { creditLine };
export type { PluginCredit, PluginLabel, PluginTier };

export type PluginView = {
  id: string;
  name: string;
  summary: string;
  description: string;
  labels: PluginLabel[];
  tier: PluginTier;
  version: string;
  permissions: string[];
  icon: PixelIcon;
  credit?: PluginCredit;
};

export const pluginPath = (id: string): string => `${PLUGINS_PATH}/${id}`;

export const PLUGINS: readonly PluginView[] = SOURCES.map((source) => ({
  id: source.id,
  name: source.name,
  summary: source.summary,
  description: COPY[source.id].description,
  labels: labelsOf(source),
  tier: source.tier,
  version: source.latestVersion,
  permissions: source.permissions.map(permissionWords),
  icon: COPY[source.id].icon as PixelIcon,
  credit: source.credit
}));
