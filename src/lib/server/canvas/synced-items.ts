import type { Db } from '$lib/server/db/client';
import type { CanvasNodeRecord } from '$lib/server/repos/canvas';
import { listNodeProducts } from '$lib/server/repos/products';
import { listNodeSocialPosts } from '$lib/server/repos/social-posts';
import { productItem, socialPostItem, type PostRow, type ProductRow, type SelectableItem } from '$lib/canvas/select-sources';
import { outputValues, type CustomOutput, type OutputValue } from '$lib/canvas/select-outputs';
import { feedFiltersOf, filterPosts, filterProducts, productFiltersOf } from '$lib/canvas/source-filters';

export type SyncedRows =
  | { type: 'products'; rows: ProductRow[] }
  | { type: 'social_account_feed'; rows: PostRow[] };

export async function syncedSourceRows(db: Db, orgId: string, source: CanvasNodeRecord): Promise<SyncedRows> {
  if (source.type === 'products') {
    const products = await listNodeProducts(db, { orgId, nodeId: source.id });
    return { type: 'products', rows: filterProducts(products, productFiltersOf(source.data.filters)) };
  }
  const posts = await listNodeSocialPosts(db, { orgId, nodeId: source.id });
  return { type: 'social_account_feed', rows: filterPosts(posts, feedFiltersOf(source.data.filters)) };
}

export function itemsOf(synced: SyncedRows): SelectableItem[] {
  return synced.type === 'products' ? synced.rows.map(productItem) : synced.rows.map(socialPostItem);
}

export async function syncedSourceItems(db: Db, orgId: string, source: CanvasNodeRecord): Promise<SelectableItem[]> {
  return itemsOf(await syncedSourceRows(db, orgId, source));
}

export function outputsAt(synced: SyncedRows, index: number, custom: readonly CustomOutput[]): Record<string, OutputValue> {
  if (index < 1 || index > synced.rows.length) {
    return {};
  }
  return synced.type === 'products'
    ? outputValues('products', synced.rows[index - 1], custom)
    : outputValues('social_account_feed', synced.rows[index - 1], custom);
}
