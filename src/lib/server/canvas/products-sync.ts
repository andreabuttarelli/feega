import type { Db } from '$lib/server/db/client';
import {
  fetchStoreProductsPage,
  fetchStoreProduct,
  classifyStoreUrl,
  type FetchedProduct,
  type StorePlatform
} from '$lib/server/store-fetch';
import { upsertNodeProducts } from '$lib/server/repos/products';

/**
 * UN GIRO DI SINCRONIZZAZIONE PER UN NODO `products`.
 *
 * Il nodo non appartiene a un brand — prende un URL di store pubblico e lo scarica, punto (la
 * decisione è del prodotto: "il nodo products deve essere indipendente da qualsiasi brand").
 * Quindi non c'è un catalogo da filtrare e non c'è un rifiuto da scrivere per "questo progetto non
 * ha un brand": ogni nodo scarica la SUA pagina, dallo store che gli è stato detto, e la scrive
 * sotto il proprio `node_id` — due nodi sullo stesso store restano due letture indipendenti, ognuna
 * proprietaria delle sue righe (`products_node_external_idx`).
 *
 * UN ERRORE SI SCRIVE LEGGIBILE, MAI UN TOKEN MUTO: lo standard è `store_failed: Bucket not found`,
 * non un `ok: false` senza perché. `fetchStoreProductsPage` già torna un errore con un prefisso che
 * dice la categoria (`invalid_url`, `store_unreachable`, `store_invalid`, `not_public`, `too_large`,
 * `fetch_failed`) — qui non lo si riscrive, lo si porta fino al nodo.
 */
export type ProductsSyncOutcome =
  | { ok: true; synced: number; after: string | null; summary: string }
  | { ok: false; error: string };

type SyncInput = {
  orgId: string;
  projectId: string | null;
  nodeId: string;
  platform: StorePlatform;
  storeUrl: string;
  limit: number;
  after: string | null;
  onlyFirstPhoto: boolean;
  category?: string;
};

const summaryOf = (count: number): string => (count === 1 ? '1 product' : `${count} products`);

/**
 * UNA VOCE INCOLLATA, UN GIRO CHE SCARICA SOLO QUELLI: `classifyStoreUrl` legge la forma dell'URL
 * (o degli URL, uno per riga) e dice cosa scaricare — un singolo prodotto, una collezione o l'intero
 * catalogo — invece di chiedere alla persona di scegliere una modalità. La piattaforma letta
 * dall'URL vince su quella dichiarata sul nodo solo quando l'URL la dice (Shopify); altrimenti
 * resta quella del nodo.
 */
async function syncSingleProducts(
  db: Db,
  input: SyncInput,
  platform: StorePlatform,
  handles: string[]
): Promise<ProductsSyncOutcome> {
  const products: FetchedProduct[] = [];

  for (const handle of handles) {
    const fetched = await fetchStoreProduct(platform, input.storeUrl, handle, input.onlyFirstPhoto);
    if (!fetched.ok) {
      return { ok: false, error: fetched.error };
    }
    products.push(fetched.product);
  }

  const synced = await upsertNodeProducts(db, {
    orgId: input.orgId,
    projectId: input.projectId,
    nodeId: input.nodeId,
    platform,
    products
  });

  return { ok: true, synced, after: null, summary: summaryOf(synced) };
}

async function syncPage(db: Db, input: SyncInput, platform: StorePlatform, category?: string): Promise<ProductsSyncOutcome> {
  const page = await fetchStoreProductsPage(platform, input.storeUrl, {
    limit: input.limit,
    after: input.after,
    onlyFirstPhoto: input.onlyFirstPhoto,
    category
  });

  if (!page.ok) {
    return { ok: false, error: page.error };
  }

  const synced = await upsertNodeProducts(db, {
    orgId: input.orgId,
    projectId: input.projectId,
    nodeId: input.nodeId,
    platform,
    products: page.products
  });

  return { ok: true, synced, after: page.after, summary: category ? `collection: ${category}` : 'whole store' };
}

export async function syncProductsNode(db: Db, input: SyncInput): Promise<ProductsSyncOutcome> {
  const classified = classifyStoreUrl(input.storeUrl);
  const platform = classified.platform ?? input.platform;

  if (classified.scope === 'products') {
    return syncSingleProducts(db, input, platform, classified.handles);
  }

  const category = classified.scope === 'collection' ? classified.category : input.category;
  return syncPage(db, input, platform, category);
}
