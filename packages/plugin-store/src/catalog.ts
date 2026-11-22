import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Origin, type Catalog, type ExternalPlugin } from '@feega/plugin-api/external';
import type { Manifest } from '@feega/plugin-api/manifest';
import { wordsOf } from '@feega/plugin-api/permission-words';
import { MANIFEST_FILE, bundleOf, permissionsOf, type Read } from './bundle';
import { enabledIn, readRegistry, type Registry } from './registry';

export type CatalogDeps = { root: string; dev: string[] };

const text = (path: string) => readFile(path, 'utf8').then((content) => content, () => undefined);

async function readFolder(dir: string): Promise<Read<{ manifest: Manifest; code: string }>> {
  const read = bundleOf(await text(join(dir, MANIFEST_FILE)));
  if (!read.ok) {
    return read;
  }
  const code = await text(join(dir, read.bundle.main));
  return code === undefined ? { ok: false, reason: `there is no ${read.bundle.main}` } : { ok: true, manifest: read.bundle.manifest, code };
}

const entry = (loaded: { manifest: Manifest; code: string }, origin: Origin, registry: Registry): ExternalPlugin => ({
  id: loaded.manifest.id,
  name: loaded.manifest.name,
  version: loaded.manifest.version,
  origin,
  enabled: enabledIn(registry, loaded.manifest.id),
  words: wordsOf(loaded.manifest),
  manifest: loaded.manifest,
  code: loaded.code
});

async function installedPlugins(root: string, registry: Registry, problems: string[]): Promise<ExternalPlugin[]> {
  const out: ExternalPlugin[] = [];
  for (const [id, held] of Object.entries(registry.installed)) {
    const dir = join(root, id, held.version);
    const read = await readFolder(dir);
    if (!read.ok) {
      problems.push(`${id}: ${read.reason}`);
      continue;
    }
    if (read.manifest.id !== id || permissionsOf(read.manifest).join() !== held.permissions.join()) {
      problems.push(`${id}: its permissions differ from the ones you approved, install it again`);
      continue;
    }
    out.push(entry(read, Origin.Installed, registry));
  }
  return out;
}

async function devPlugins(dev: string[], registry: Registry, problems: string[]): Promise<ExternalPlugin[]> {
  const out: ExternalPlugin[] = [];
  for (const dir of dev) {
    const read = await readFolder(dir);
    if (read.ok) {
      out.push(entry(read, Origin.Dev, registry));
      continue;
    }
    problems.push(`${dir}: ${read.reason}`);
  }
  return out;
}

export async function catalogOf({ root, dev }: CatalogDeps): Promise<Catalog> {
  const registry = readRegistry(root);
  const problems: string[] = [];
  const mine = await devPlugins(dev, registry, problems);
  const names = new Set(mine.map((one) => one.id));
  const installed = (await installedPlugins(root, registry, problems)).filter((one) => !names.has(one.id));
  return { plugins: [...installed, ...mine], disabled: registry.disabled, problems };
}
