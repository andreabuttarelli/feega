import { normalize } from 'node:path';
import { debranded } from './debrand';

export const FREE_TIER = 'free';

const REPO = 'https://raw.githubusercontent.com/ruixenui/ruixen.com';
const COMPONENT_TYPE = 'registry:ui';
const LIBRARY_DIR = 'src/components/ruixen/';

export type OssItem = { name: string; type: string; title?: string; description?: string };

export type OssRegistry = { items: OssItem[] };

export type CatalogItem = { name: string; title: string; description: string; tier: string; registry: string };

export type Catalog = { name: string; homepage: string; source: string; commit: string; publicBase: string; generatedAt: string; items: CatalogItem[]; skipped?: { name: string; reason: string }[] };

export type RegistryFile = { path: string; target: string; content: string };

export type RegistryItem = { name: string; type: string; dependencies?: string[]; registryDependencies?: string[]; files: RegistryFile[] };

export type LandedFile = { path: string; content: string };

export type Installable = { ok: true; files: LandedFile[]; dependencies: string[] } | { ok: false; reason: string };

const NEXT_RUNTIME = ['next/navigation', 'next/font/google', 'next/font'];

const LANDING: Record<string, { from: string; to: string }> = {
  [COMPONENT_TYPE]: { from: 'components/ruixen/', to: LIBRARY_DIR },
  'registry:example': { from: 'components/', to: `${LIBRARY_DIR}demos/` }
};

const SUPPORT = /from\s+["']@\/(components\/ui\/[a-z0-9-]+|hooks\/[a-z0-9-]+)["']/g;
const SUPPORT_EXTENSION: Record<string, string> = { components: '.tsx', hooks: '.ts' };
const FOREIGN = /from\s+["']@\/(?!components\/ui\/|hooks\/|lib\/utils|registry\/ruixenui\/|components\/ruixen\/)([^"']+)["']/;

export const registryUrl = (commit: string, name: string) => `${REPO}/${commit}/public/r/${name}.json`;

export const sourceUrl = (commit: string, path: string) => `${REPO}/${commit}/${path}`;

const pinnedTo = (url: string) => /^https:\/\/raw\.githubusercontent\.com\/ruixenui\/ruixen\.com\/([0-9a-f]{40})\/public\/r\/[a-z0-9-]+\.json$/.exec(url)?.[1] ?? null;

export function freeCatalog(registry: OssRegistry, commit: string, generatedAt: string): Catalog {
  const items = registry.items.filter((i) => i.type === COMPONENT_TYPE).map((i) => ({ name: i.name, title: i.title ?? i.name, description: i.description ?? '', tier: FREE_TIER, registry: registryUrl(commit, i.name) }));
  return { name: 'ruixen', homepage: 'https://ruixen.com', source: 'https://github.com/ruixenui/ruixen.com', commit, publicBase: sourceUrl(commit, 'public/'), generatedAt, items };
}

export function supportPaths(content: string): string[] {
  return [...content.matchAll(SUPPORT)].map((m) => `${m[1]}${SUPPORT_EXTENSION[m[1].split('/')[0]]}`);
}

function landedPath(type: string, target: string): string | null {
  const landing = LANDING[type];
  if (!landing || !target.startsWith(landing.from)) {
    return null;
  }
  const path = normalize(`${landing.to}${target.slice(landing.from.length)}`);
  return path.startsWith(landing.to) ? path : null;
}

const rewritten = (content: string) => debranded(content).replaceAll('@/registry/ruixenui/', '@/components/ruixen/').replaceAll('"../ruixenui/', '"@/components/ruixen/');

export function installable(url: string, item: RegistryItem): Installable {
  if (!pinnedTo(url)) {
    return { ok: false, reason: `${url} is not a pinned item of the open-source Ruixen registry` };
  }

  const files = item.files.map((f) => ({ path: landedPath(item.type, f.target), content: rewritten(f.content) }));
  const outside = item.files.find((_, i) => !files[i].path);
  if (outside) {
    return { ok: false, reason: `${item.name} writes ${outside.target}, outside the library` };
  }

  const runtime = NEXT_RUNTIME.find((module) => files.some((f) => new RegExp(`from\\s+["']${module}["']`).test(f.content)));
  if (runtime) {
    return { ok: false, reason: `${item.name} imports ${runtime}, which a plain Vite app does not have` };
  }

  const foreign = files.map((f) => FOREIGN.exec(f.content)).find(Boolean);
  if (foreign) {
    return { ok: false, reason: `${item.name} imports @/${foreign[1]}, which the registry does not ship` };
  }

  return { ok: true, files: files as LandedFile[], dependencies: item.dependencies ?? [] };
}

const FEEGA_MARKS = 'marks/';

const PUBLIC_ASSET = /["'`]\/((?:[a-z0-9_-]+\/)*[a-z0-9_.-]+\.(?:svg|png|jpe?g|webp|gif|avif))["'`]/gi;

export function publicAssets(content: string): string[] {
  return [...new Set([...content.matchAll(PUBLIC_ASSET)].map((m) => m[1]).filter((p) => !p.split('/').includes('..') && !p.startsWith(FEEGA_MARKS)))];
}
