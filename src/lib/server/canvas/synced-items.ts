import type { Db } from '$lib/server/db/client';
import type { CanvasNodeRecord } from '$lib/server/repos/canvas';
import { listNodeProducts } from '$lib/server/repos/products';
import { listNodeSocialPosts } from '$lib/server/repos/social-posts';
import { productItem, socialPostItem, type SelectableItem } from '$lib/canvas/select-sources';
import { feedFiltersOf, filterPosts, filterProducts, productFiltersOf } from '$lib/canvas/source-filters';

export async function syncedSourceItems(db: Db, orgId: string, source: CanvasNodeRecord): Promise<SelectableItem[]> {
  if (source.type === 'products') {
    const products = await listNodeProducts(db, { orgId, nodeId: source.id });
    return filterProducts(products, productFiltersOf(source.data.filters)).map(productItem);
  }
  const posts = await listNodeSocialPosts(db, { orgId, nodeId: source.id });
  return filterPosts(posts, feedFiltersOf(source.data.filters)).map(socialPostItem);
}
