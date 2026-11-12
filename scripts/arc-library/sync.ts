import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { freeCatalog, installable, type Catalog, type RegistryItem } from './registry';

const LIBRARY = join(import.meta.dirname, '../../libraries/arc');
const CATALOG_FILE = join(LIBRARY, 'catalog.json');
const REMOTE_CATALOG = 'https://uiarc.dev/r/catalog.json';
const REGISTRY = /^https:\/\/uiarc\.dev\/r\/[a-z0-9-]+\.json$/;
const AGENT = { 'user-agent': 'curl/8.7.1' };

const json = async <T>(url: string): Promise<T> => {
  const res = await fetch(url, { headers: AGENT });
  if (!res.ok) {
    throw new Error(`${url}: ${res.status}`);
  }
  return (await res.json()) as T;
};

async function pinned(): Promise<Catalog> {
  if (!process.argv.includes('--pin')) {
    return JSON.parse(readFileSync(CATALOG_FILE, 'utf8')) as Catalog;
  }
  const catalog = freeCatalog(await json<Catalog>(REMOTE_CATALOG));
  writeFileSync(CATALOG_FILE, `${JSON.stringify(catalog, null, 2)}\n`);
  return catalog;
}

async function install(catalog: Catalog): Promise<Set<string>> {
  const queue = [...(catalog.foundation ? [catalog.foundation] : []), ...catalog.items.map((i) => i.registry)];
  const seen = new Set<string>();
  const dependencies = new Set<string>();

  while (queue.length) {
    const url = queue.shift()!;
    if (seen.has(url)) {
      continue;
    }
    seen.add(url);
    if (!REGISTRY.test(url)) {
      throw new Error(`${url} is not an Arc registry item`);
    }

    const item = await json<RegistryItem>(url);
    const landed = installable(item);
    if (!landed.ok) {
      throw new Error(landed.reason);
    }

    for (const file of landed.files) {
      mkdirSync(dirname(join(LIBRARY, file.path)), { recursive: true });
      writeFileSync(join(LIBRARY, file.path), file.content);
    }
    landed.dependencies.forEach((d) => dependencies.add(d));
    queue.push(...(item.registryDependencies ?? []));
  }
  return dependencies;
}

const catalog = await pinned();
const dependencies = await install(catalog);
console.log(`${catalog.items.length} free items installed; npm dependencies: ${[...dependencies].sort().join(' ')}`);
