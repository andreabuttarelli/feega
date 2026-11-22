import type { Catalog } from '@feega/plugin-api/external';
import type { Manifest } from '@feega/plugin-api/manifest';

export const BUILT_IN_STAMP = 'built-in';

export type Wanted = { id: string; stamp: string; manifest: Manifest; code: string };

export function wantedOf(builtIn: Manifest[], catalog: Catalog): Wanted[] {
  const owned = new Set(builtIn.map((manifest) => manifest.id));
  const own = builtIn.filter((manifest) => !catalog.disabled.includes(manifest.id)).map((manifest) => ({ id: manifest.id, stamp: BUILT_IN_STAMP, manifest, code: '' }));
  const added = catalog.plugins.filter((plugin) => plugin.enabled && !owned.has(plugin.id)).map((plugin) => ({ id: plugin.id, stamp: JSON.stringify([plugin.manifest, plugin.code]), manifest: plugin.manifest, code: plugin.code }));
  return [...own, ...added];
}

export function reconcile(loaded: Map<string, string>, wanted: Wanted[]): { unload: string[]; load: Wanted[] } {
  const stamps = new Map(wanted.map((one) => [one.id, one.stamp]));
  return {
    unload: [...loaded].filter(([id, stamp]) => stamps.get(id) !== stamp).map(([id]) => id),
    load: wanted.filter((one) => loaded.get(one.id) !== one.stamp)
  };
}
