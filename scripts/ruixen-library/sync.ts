import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { freeCatalog, installable, publicAssets, registryUrl, sourceUrl, supportPaths, type Catalog, type LandedFile, type OssRegistry, type RegistryItem } from './registry';

const LIBRARY = join(import.meta.dirname, '../../libraries/ruixen');
const CATALOG_FILE = join(LIBRARY, 'catalog.json');
const PIN_FLAG = '--pin=';
const RUIXEN_ITEM = /^https:\/\/ruixen\.com\/r\/([a-z0-9-]+)(\.json)?$/;

const fetched = async (url: string): Promise<Response> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${url}: ${res.status}`);
  }
  return res;
};

const json = async <T>(url: string): Promise<T> => (await (await fetched(url)).json()) as T;

async function pinned(): Promise<Catalog> {
  const commit = process.argv.find((a) => a.startsWith(PIN_FLAG))?.slice(PIN_FLAG.length);
  if (!commit) {
    return JSON.parse(readFileSync(CATALOG_FILE, 'utf8')) as Catalog;
  }
  return freeCatalog(await json<OssRegistry>(sourceUrl(commit, 'registry.json')), commit, new Date().toISOString());
}

const pinnedUrl = (commit: string, dependency: string) => {
  const ruixen = RUIXEN_ITEM.exec(dependency);
  return ruixen ? registryUrl(commit, ruixen[1]) : null;
};

async function landed(commit: string, name: string, demos: Set<string>): Promise<{ files: LandedFile[]; dependencies: string[] } | string> {
  const queue = [registryUrl(commit, name), ...(demos.has(`${name}-demo`) ? [registryUrl(commit, `${name}-demo`)] : [])];
  const seen = new Set<string>();
  const files: LandedFile[] = [];
  const dependencies: string[] = [];

  while (queue.length) {
    const url = queue.shift()!;
    if (seen.has(url)) {
      continue;
    }
    seen.add(url);
    const item = await json<RegistryItem>(url);
    const verdict = installable(url, item);
    if (!verdict.ok) {
      return verdict.reason;
    }
    files.push(...verdict.files);
    dependencies.push(...verdict.dependencies);
    queue.push(...(item.registryDependencies ?? []).flatMap((d) => pinnedUrl(commit, d) ?? []));
  }
  return { files, dependencies };
}

async function support(commit: string, files: LandedFile[]): Promise<void> {
  const queue = files.flatMap((f) => supportPaths(f.content));
  const seen = new Set<string>();
  while (queue.length) {
    const path = queue.shift()!;
    if (seen.has(path)) {
      continue;
    }
    seen.add(path);
    const content = await (await fetched(sourceUrl(commit, path))).text();
    mkdirSync(dirname(join(LIBRARY, 'src', path)), { recursive: true });
    writeFileSync(join(LIBRARY, 'src', path), content);
    queue.push(...supportPaths(content));
  }
}

async function assets(commit: string, files: LandedFile[]): Promise<string[]> {
  const missing: string[] = [];
  for (const path of new Set(files.flatMap((f) => publicAssets(f.content)))) {
    const res = await fetch(sourceUrl(commit, `public/${path}`));
    if (!res.ok) {
      missing.push(path);
      continue;
    }
    mkdirSync(dirname(join(LIBRARY, 'public', path)), { recursive: true });
    writeFileSync(join(LIBRARY, 'public', path), Buffer.from(await res.arrayBuffer()));
  }
  return missing;
}

const catalog = await pinned();
const oss = await json<OssRegistry>(sourceUrl(catalog.commit, 'registry.json'));
const demos = new Set(oss.items.filter((i) => i.type === 'registry:example').map((i) => i.name));
const kept: Catalog['items'] = [];
const skipped = [...(catalog.skipped ?? [])];
const all: LandedFile[] = [];
const dependencies = new Set<string>();

for (const entry of catalog.items) {
  const result = await landed(catalog.commit, entry.name, demos);
  if (typeof result === 'string') {
    skipped.push({ name: entry.name, reason: result });
    continue;
  }
  kept.push(entry);
  all.push(...result.files);
  result.dependencies.forEach((d) => dependencies.add(d));
}

for (const file of all) {
  mkdirSync(dirname(join(LIBRARY, file.path)), { recursive: true });
  writeFileSync(join(LIBRARY, file.path), file.content);
}
await support(catalog.commit, all);
const missing = await assets(catalog.commit, all);
writeFileSync(CATALOG_FILE, `${JSON.stringify({ ...catalog, items: kept, skipped }, null, 2)}\n`);
console.log(`${kept.length} free items installed, ${skipped.length} skipped, public files missing upstream: ${missing.join(' ') || 'none'}; npm dependencies: ${[...dependencies].sort().join(' ')}`);
