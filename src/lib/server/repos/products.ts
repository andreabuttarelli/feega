import type { Db } from '$lib/server/db/client';
import type { Database, Json } from '$lib/database.types';
import type { FetchedProduct, StorePlatform } from '$lib/server/store-fetch';
import type { ProductOptions, ProductVariant } from '$lib/canvas/product-shape';

type ProductRow = Database['public']['Tables']['products']['Row'];

export type Product = {
  id: string;
  nodeId: string | null;
  projectId: string | null;
  platform: StorePlatform;
  externalId: string;
  handle: string | null;
  title: string;
  description: string | null;
  price: number | null;
  currency: string | null;
  url: string | null;
  images: Array<{ url: string; alt?: string | null; position?: number }>;
  available: boolean | null;
  compareAtPrice: number | null;
  tags: string[];
  vendor: string | null;
  productType: string | null;
  sku: string | null;
  variants: ProductVariant[];
  options: ProductOptions;
  syncedAt: string;
};

const PRODUCT_COLUMNS =
  'id, node_id, project_id, platform, external_id, handle, title, description, price, currency, url, images, available, compare_at_price, tags, vendor, product_type, sku, variants, options, synced_at';

type ProductColumns = Pick<
  ProductRow,
  | 'id'
  | 'node_id'
  | 'project_id'
  | 'platform'
  | 'external_id'
  | 'handle'
  | 'title'
  | 'description'
  | 'price'
  | 'currency'
  | 'url'
  | 'images'
  | 'available'
  | 'compare_at_price'
  | 'tags'
  | 'vendor'
  | 'product_type'
  | 'sku'
  | 'variants'
  | 'options'
  | 'synced_at'
>;

function toProduct(row: ProductColumns): Product {
  return {
    id: row.id,
    nodeId: row.node_id,
    projectId: row.project_id,
    platform: row.platform as StorePlatform,
    externalId: row.external_id,
    handle: row.handle,
    title: row.title,
    description: row.description,
    price: row.price === null ? null : Number(row.price),
    currency: row.currency,
    url: row.url,
    images: (row.images ?? []) as Product['images'],
    available: row.available,
    compareAtPrice: row.compare_at_price === null ? null : Number(row.compare_at_price),
    tags: row.tags ?? [],
    vendor: row.vendor,
    productType: row.product_type,
    sku: row.sku,
    variants: (row.variants ?? []) as ProductVariant[],
    options: (row.options ?? {}) as ProductOptions,
    syncedAt: row.synced_at
  };
}

const richColumns = (p: FetchedProduct) => ({
  compare_at_price: p.compareAtPrice,
  tags: p.tags,
  vendor: p.vendor,
  product_type: p.productType,
  sku: p.sku,
  variants: p.variants as Json,
  options: p.options as Json
});

export async function listNodeProducts(
  db: Db,
  scope: { orgId: string; nodeId: string }
): Promise<Product[]> {
  const { data, error } = await db
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('org_id', scope.orgId)
    .eq('node_id', scope.nodeId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }
  return (data ?? []).map(toProduct);
}

export async function upsertNodeProducts(
  db: Db,
  input: {
    orgId: string;
    projectId: string | null;
    nodeId: string;
    platform: StorePlatform;
    products: FetchedProduct[];
  }
): Promise<number> {
  if (!input.products.length) {
    return 0;
  }

  const syncedAt = new Date().toISOString();
  const rows = input.products.map((p) => ({
    org_id: input.orgId,
    project_id: input.projectId,
    node_id: input.nodeId,
    platform: input.platform,
    external_id: p.externalId,
    handle: p.handle,
    title: p.title,
    description: p.description,
    price: p.price,
    currency: p.currency,
    url: p.url,
    images: p.images as Json,
    available: p.available,
    ...richColumns(p),
    synced_at: syncedAt
  }));

  const { error } = await db
    .from('products')
    .upsert(rows, { onConflict: 'node_id,platform,external_id' });

  if (error) {
    throw error;
  }
  return rows.length;
}

export async function deleteNodeProducts(db: Db, scope: { orgId: string; nodeId: string }): Promise<void> {
  const { error } = await db.from('products').delete().eq('org_id', scope.orgId).eq('node_id', scope.nodeId);

  if (error) {
    throw error;
  }
}

export async function replaceNodeProducts(
  db: Db,
  input: {
    orgId: string;
    projectId: string | null;
    nodeId: string;
    platform: StorePlatform;
    products: FetchedProduct[];
  }
): Promise<number> {
  await deleteNodeProducts(db, { orgId: input.orgId, nodeId: input.nodeId });
  return upsertNodeProducts(db, input);
}
