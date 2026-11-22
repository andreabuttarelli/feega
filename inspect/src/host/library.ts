import { readFile } from 'node:fs/promises';
import type { InsertItem } from '@feega/live-edit/library-insert';
import type { Catalog } from '../../../packages/library/src/catalog';
import type { LibraryEntry } from '../messages';

export const INCLUDED_IN_CLOUD = 'Included in Feega Cloud';

const PRO_TIER = 'pro';
const NO_FILES: InsertItem['files'] = { svelte: [], react: [], vue: [], astro: [] };

export type InsertAsk = { ok: true; item: InsertItem; tokens: string; pro: boolean } | { ok: false; reason: string };

export const entriesOf = (catalog: Catalog): LibraryEntry[] => catalog.items.map(({ id, name, description, category, tags, tier, page }) => ({ id, name, description, category, tags, tier, page }));

export function insertAskOf(catalog: Catalog | null, id: string): InsertAsk {
  if (!catalog) {
    return { ok: false, reason: 'the library is not available' };
  }
  const found = catalog.items.find((item) => item.id === id);
  if (!found) {
    return { ok: false, reason: `no library item ${id}` };
  }
  const pro = found.tier === PRO_TIER;
  const files = pro ? NO_FILES : found.files;
  return { ok: true, item: { id: found.id, component: found.component, fonts: found.fonts, files }, tokens: catalog.tokens, pro };
}

export function catalogFile(path: string): () => Promise<Catalog | null> {
  let loaded: Promise<Catalog | null> | null = null;
  return () => (loaded ??= readFile(path, 'utf8').then((text) => JSON.parse(text) as Catalog, () => null));
}
