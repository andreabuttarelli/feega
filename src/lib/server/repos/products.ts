import type { Db } from '$lib/server/db/client';
import type { Database, Json } from '$lib/database.types';
import type { FetchedProduct, StorePlatform } from '$lib/server/store-fetch';
import type { ProductOptions, ProductVariant } from '$lib/canvas/product-shape';

/**
 * IL CATALOGO CHE UN NODO `products` HA SCARICATO.
 *
 * `node_id` possiede la riga: un `products` node non appartiene a un brand — prende un URL di
 * store e basta — quindi `brand_id` resta nullable e non è la chiave. La chiave è
 * `products_node_external_idx`, un indice unico su `(node_id, platform, external_id)` — NON
 * parziale (`20260927130000_products_node_external_idx.sql` spiega perché: PostgREST genera
 * l'upsert come `ON CONFLICT (colonne) DO UPDATE` senza `WHERE`, e Postgres può far combaciare
 * quell'`ON CONFLICT` solo con un indice la cui definizione è IDENTICA — un indice parziale non
 * matcha mai, `42P10` ogni volta). Due NULL non collidono comunque in un indice non parziale, quindi
 * un `node_id` nullo (ogni riga di `products_brand_external_idx`, sotto) non collide con nessun'altra
 * riga tramite QUESTO indice — la protezione resta la stessa, solo espressa senza predicato.
 *
 * L'UPSERT usa `onConflict` su quello stesso indice: la stessa riga letta due volte aggiorna,
 * mai duplica.
 */
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

/**
 * UN GIRO DI SINCRONIZZAZIONE: le righe di questa pagina entrano, quelle di ieri restano finché
 * non arriva un prodotto con lo stesso `external_id` che le sostituisce. Non è uno swap totale
 * come `replaceBrandCatalog` — quel repository cancella tutto il catalogo del brand a ogni giro,
 * cosa che qui moltiplicherebbe le query per un nodo che pagina 250 prodotti alla volta in più
 * chiamate: l'upsert riga per riga è già la forma giusta perché il vincolo unico la rende sicura.
 */
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

export async function listBrandProducts(db: Db, scope: { orgId: string; brandId: string; limit: number }): Promise<Product[]> {
  const { data, error } = await db
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('org_id', scope.orgId)
    .eq('brand_id', scope.brandId)
    .order('created_at', { ascending: true })
    .limit(scope.limit);

  if (error) {
    throw error;
  }
  return (data ?? []).map(toProduct);
}

/**
 * IL CATALOGO DI UN BRAND APPENA CREATO — non di un nodo. `NEW_DATABASE_STRUCTURE.md` lo dice
 * esplicito: «la sincronizzazione è una sola, per brand» (`unique (brand_id, platform,
 * external_id)`), un asse diverso da `products_node_external_idx` che governa
 * `upsertNodeProducts` sopra. Il wizard non ha un `products` node da cui appendere le righe — il
 * brand non esiste ancora quando l'analisi del sito gira — quindi scrive qui, con `node_id`
 * assente, non `null` esplicito: un `onConflict` su `node_id` con due NULL non collide mai in
 * Postgres, e lasciarlo fuori dalla riga evita di far leva su quel comportamento per sbaglio.
 */
export async function insertBrandProducts(
  db: Db,
  input: {
    orgId: string;
    brandId: string;
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
    brand_id: input.brandId,
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
    .upsert(rows, { onConflict: 'brand_id,platform,external_id' });

  if (error) {
    throw error;
  }
  return rows.length;
}
