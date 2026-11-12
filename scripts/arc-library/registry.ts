import { normalize } from 'node:path';

export enum Tier {
  Free = 'free',
  Pro = 'pro'
}

export type CatalogItem = { name: string; title: string; description: string; tier: string; category?: string; registry: string };

export type Catalog = { name: string; homepage: string; generatedAt: string; foundation?: string; items: CatalogItem[] };

export type RegistryFile = { path: string; target: string; content: string };

export type RegistryItem = { name: string; dependencies?: string[]; registryDependencies?: string[]; files: RegistryFile[]; meta?: { tier?: string } };

export type LandedFile = { path: string; content: string };

export type Installable = { ok: true; files: LandedFile[]; dependencies: string[] } | { ok: false; reason: string };

const TARGET_PREFIX = '@components/arc/';
const LIBRARY_DIR = 'src/components/arc/';

export function freeCatalog(catalog: Catalog): Catalog {
  const items = catalog.items.filter((i) => i.tier === Tier.Free).map(({ name, title, description, tier, category, registry }) => ({ name, title, description, tier, category, registry }));
  return { name: catalog.name, homepage: catalog.homepage, generatedAt: catalog.generatedAt, foundation: catalog.foundation, items };
}

function landedPath(target: string): string | null {
  if (!target.startsWith(TARGET_PREFIX)) {
    return null;
  }
  const path = normalize(`${LIBRARY_DIR}${target.slice(TARGET_PREFIX.length)}`);
  return path.startsWith(LIBRARY_DIR) ? path : null;
}

export function installable(item: RegistryItem): Installable {
  if (item.meta?.tier !== Tier.Free) {
    return { ok: false, reason: `${item.name} is not in the free tier` };
  }

  const files = item.files.map((f) => ({ path: landedPath(f.target), content: f.content }));
  const outside = item.files.find((_, i) => !files[i].path);
  if (outside) {
    return { ok: false, reason: `${item.name} writes ${outside.target}, outside the library` };
  }

  return { ok: true, files: files as LandedFile[], dependencies: item.dependencies ?? [] };
}
