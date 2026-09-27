import type { Db } from '$lib/server/db/client';
import { findOrCreateColourAsset } from '$lib/server/brand-colour-asset';
import { listBrandAccounts } from '$lib/server/repos/social-accounts';
import { tokenizeChips, type ChipToken } from '$lib/canvas/brand-content-chips';
import type { BrandDetails } from '$lib/canvas/brand-pieces';

type Scope = { orgId: string; brandId: string };

function contentChips<K extends ChipToken['kind']>(content: string, kind: K): Extract<ChipToken, { kind: K }>[] {
  return tokenizeChips(content).filter((t): t is Extract<ChipToken, { kind: K }> => t.kind === kind);
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    const k = key(item);
    if (!seen.has(k)) {
      seen.set(k, item);
    }
  }
  return [...seen.values()];
}

async function brandStores(db: Db, scope: Scope): Promise<BrandDetails['stores']> {
  const { data, error } = await db
    .from('products')
    .select('platform, store_url')
    .eq('org_id', scope.orgId)
    .eq('brand_id', scope.brandId);
  if (error) {
    throw error;
  }

  const stores = (data ?? [])
    .filter((row): row is { platform: string; store_url: string } => Boolean(row.store_url))
    .map((row) => ({ platform: row.platform, url: row.store_url }));
  return uniqueBy(stores, (s) => `${s.platform}|${s.url}`);
}

async function colourSwatches(db: Db, orgId: string, content: string): Promise<BrandDetails['colours']> {
  const hexes = [...new Set(contentChips(content, 'colour').map((t) => t.hex))];
  return Promise.all(
    hexes.map(async (hex) => {
      const found = await findOrCreateColourAsset(db, { orgId, hex });
      return { hex, assetId: found?.asset.id ?? null, url: found?.url ?? null };
    })
  );
}

export async function loadBrandDetails(db: Db, scope: Scope): Promise<BrandDetails | null> {
  const { data: brand, error } = await db
    .from('brands')
    .select('id, website, content')
    .eq('org_id', scope.orgId)
    .eq('id', scope.brandId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!brand) {
    return null;
  }

  const content = brand.content ?? '';
  const [accounts, stores, colours] = await Promise.all([
    listBrandAccounts(db, scope),
    brandStores(db, scope),
    colourSwatches(db, scope.orgId, content)
  ]);

  const connected = accounts
    .filter((a): a is typeof a & { handle: string } => Boolean(a.handle))
    .map((a) => ({ platform: a.platform as string, handle: a.handle }));
  const written = contentChips(content, 'handle').map((t) => ({ platform: t.platform, handle: t.handle }));
  const handles = uniqueBy([...connected, ...written], (h) => `${h.platform}|${h.handle.toLowerCase()}`);

  return { website: brand.website, colours, handles, stores };
}
