import { safeFetchUrl, SafeFetchError } from '$lib/server/tool-guard';

/**
 * IL CATALOGO PUBBLICO DI UNO STORE, MAI IL SUO PANNELLO PRIVATO.
 *
 * Shopify e WooCommerce espongono ognuno un endpoint che non chiede autenticazione:
 * `/products.json` sul primo, `/wp-json/wc/store/v1/products` sul secondo. Non è l'API che un
 * negoziante userebbe per gestire il suo store — è la stessa vetrina che un browser scarica
 * quando qualcuno visita la pagina prodotti. Questo file legge SOLO quella.
 *
 * `packages/site-analysis/src/crawl.ts` fa già questa lettura per l'analisi del brand
 * (`fetchShopifyProducts`/`fetchWooCommerceProducts`), ma torna una forma pensata per un brief di
 * marketing, non per la tabella `products` — e vive in un package che non può importare `$lib`,
 * quindi non può usare `assertPublicUrl`. Qui la stessa lettura torna la forma che
 * `repos/products.ts` scrive, e passa dalla guardia SSRF già in produzione
 * (`tool-guard.ts::safeFetchUrl`) invece di riscriverne una copia — la stessa che l'MCP e i tool
 * pubblici usano già per un URL scritto da una persona.
 */

export type FetchedProduct = {
  externalId: string;
  handle: string | null;
  title: string;
  description: string | null;
  price: number | null;
  currency: string | null;
  url: string | null;
  images: Array<{ url: string; alt?: string | null; position?: number }>;
  available: boolean | null;
};

export type StorePlatform = 'shopify' | 'woocommerce';

export type StorePageOptions = { limit: number; after: string | null; onlyFirstPhoto: boolean; category?: string };

const categoryOf = (opts: StorePageOptions): string => encodeURIComponent(opts.category?.trim() ?? '');

export type FetchProductsPage = {
  products: FetchedProduct[];
  /** Il cursore per la pagina successiva, o null quando questa era l'ultima. */
  after: string | null;
};

export type FetchProductsResult =
  | ({ ok: true } & FetchProductsPage)
  | { ok: false; error: string };

const MAX_BYTES = 5_000_000;
const SHOPIFY_MAX_LIMIT = 250;
const WOOCOMMERCE_MAX_LIMIT = 100;

function originOf(storeUrl: string): URL | null {
  try {
    return new URL(storeUrl);
  } catch {
    return null;
  }
}

/**
 * Solo la prima foto, quando il nodo lo chiede — un carosello con una miniatura per prodotto pesa
 * meno di uno con la galleria intera, e la card sulla tela ne mostra comunque una sola alla volta.
 */
function limitPhotos(images: FetchedProduct['images'], onlyFirst: boolean): FetchedProduct['images'] {
  return onlyFirst ? images.slice(0, 1) : images;
}

/** L'HTML resta HTML dentro `body_html`: il carosello mostra testo, non markup. */
function stripHtml(html: unknown): string | null {
  const text = String(html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text || null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shopifyProductOf(raw: any, origin: string, onlyFirstPhoto: boolean): FetchedProduct {
  const variant = Array.isArray(raw.variants) ? raw.variants[0] : undefined;
  const images: FetchedProduct['images'] = Array.isArray(raw.images)
    ? raw.images
        .map((img: unknown, i: number) => {
          const src = typeof img === 'string' ? img : (img as { src?: string })?.src;
          return src ? { url: src, position: i } : null;
        })
        .filter((x: unknown): x is FetchedProduct['images'][number] => x !== null)
    : [];

  const handle = typeof raw.handle === 'string' ? raw.handle.trim() : '';
  const url = handle && !/[/?#\s]/.test(handle) ? `${origin}/products/${encodeURIComponent(handle)}` : null;

  return {
    externalId: String(raw.id ?? ''),
    handle: handle || null,
    title: String(raw.title ?? ''),
    description: stripHtml(raw.body_html),
    price: variant?.price != null ? Number(variant.price) : null,
    currency: null,
    url,
    images: limitPhotos(images, onlyFirstPhoto),
    available: typeof raw.available === 'boolean' ? raw.available : null
  };
}

/**
 * `/products.json` pagina con `page`, non con un cursore — quindi `after` è il numero di pagina
 * già letta, scritto come stringa perché il resto del nodo (`limit`/`after` di `productsSchema`)
 * tratta `after` come opaco e non come "il numero 2": un domani che WooCommerce arrivi con un
 * cursore vero, il chiamante non deve sapere quale forma porta quale piattaforma.
 */
export async function fetchShopifyPage(
  storeUrl: string,
  opts: StorePageOptions
): Promise<FetchProductsResult> {
  const origin = originOf(storeUrl);
  if (!origin) return { ok: false, error: 'invalid_url: not a valid store URL' };

  const page = opts.after ? Math.max(1, Number(opts.after) || 1) : 1;
  const limit = Math.min(Math.max(1, opts.limit), SHOPIFY_MAX_LIMIT);
  const category = categoryOf(opts);
  const collection = category ? `/collections/${category}` : '';
  const target = `${origin.origin}${collection}/products.json?limit=${limit}&page=${page}`;

  try {
    const res = await safeFetchUrl(target, { maxBytes: MAX_BYTES });
    if (!res.ok) return { ok: false, error: `store_unreachable: /products.json returned ${res.status}` };

    let parsed: unknown;
    try {
      parsed = JSON.parse(res.body);
    } catch {
      return { ok: false, error: 'store_invalid: /products.json did not return JSON — is this a Shopify store?' };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawProducts = (parsed as any)?.products;
    if (!Array.isArray(rawProducts)) {
      return { ok: false, error: 'store_invalid: /products.json has no "products" array — is this a Shopify store?' };
    }

    const products = rawProducts.map((p) => shopifyProductOf(p, origin.origin, opts.onlyFirstPhoto));
    const after = rawProducts.length === limit ? String(page + 1) : null;
    return { ok: true, products, after };
  } catch (e) {
    if (e instanceof SafeFetchError) return { ok: false, error: `${e.reason}: ${e.message}` };
    return { ok: false, error: `fetch_failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wooProductOf(raw: any, divisor: number, onlyFirstPhoto: boolean): FetchedProduct {
  const images: FetchedProduct['images'] = Array.isArray(raw.images)
    ? raw.images
        .map((img: unknown, i: number) => {
          const src = (img as { src?: string })?.src;
          return src ? { url: src, position: i } : null;
        })
        .filter((x: unknown): x is FetchedProduct['images'][number] => x !== null)
    : [];

  const rawPrice = raw.prices?.price;
  const price = rawPrice != null ? Number(rawPrice) / divisor : null;
  const permalink = typeof raw.permalink === 'string' ? raw.permalink.trim() : '';

  return {
    externalId: String(raw.id ?? ''),
    handle: typeof raw.slug === 'string' ? raw.slug : null,
    title: decodeHtmlEntities(String(raw.name ?? '')),
    description: stripHtml(raw.short_description || raw.description),
    price,
    currency: typeof raw.prices?.currency_code === 'string' ? raw.prices.currency_code : null,
    url: /^https?:\/\//i.test(permalink) ? permalink : null,
    images: limitPhotos(images, onlyFirstPhoto),
    available: typeof raw.is_in_stock === 'boolean' ? raw.is_in_stock : null
  };
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * Il Store API pagina con `page`/`per_page` come Shopify, ma dichiara il totale delle pagine in
 * `X-WP-TotalPages` — qui non lo si legge: la stessa regola "meno di per_page = ultima pagina"
 * di Shopify basta e non dipende da un header che un proxy davanti al sito può anche togliere.
 */
export async function fetchWooCommercePage(
  storeUrl: string,
  opts: StorePageOptions
): Promise<FetchProductsResult> {
  const origin = originOf(storeUrl);
  if (!origin) return { ok: false, error: 'invalid_url: not a valid store URL' };

  const page = opts.after ? Math.max(1, Number(opts.after) || 1) : 1;
  const limit = Math.min(Math.max(1, opts.limit), WOOCOMMERCE_MAX_LIMIT);
  const category = categoryOf(opts);
  const target = `${origin.origin}/wp-json/wc/store/v1/products?per_page=${limit}&page=${page}${category ? `&category=${category}` : ''}`;

  try {
    const res = await safeFetchUrl(target, { maxBytes: MAX_BYTES });
    if (!res.ok) {
      return { ok: false, error: `store_unreachable: WooCommerce Store API returned ${res.status}` };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(res.body);
    } catch {
      return { ok: false, error: 'store_invalid: Store API did not return JSON — is this a WooCommerce store?' };
    }

    if (!Array.isArray(parsed)) {
      return { ok: false, error: 'store_invalid: Store API did not return a product list — is this a WooCommerce store?' };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawProducts = parsed as any[];
    const minorUnit = Number(rawProducts[0]?.prices?.currency_minor_unit ?? 2);
    const divisor = Math.pow(10, Number.isFinite(minorUnit) ? minorUnit : 2);

    const products = rawProducts.map((p) => wooProductOf(p, divisor, opts.onlyFirstPhoto));
    const after = rawProducts.length === limit ? String(page + 1) : null;
    return { ok: true, products, after };
  } catch (e) {
    if (e instanceof SafeFetchError) return { ok: false, error: `${e.reason}: ${e.message}` };
    return { ok: false, error: `fetch_failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function fetchStoreProductsPage(
  platform: StorePlatform,
  storeUrl: string,
  opts: StorePageOptions
): Promise<FetchProductsResult> {
  return platform === 'shopify' ? fetchShopifyPage(storeUrl, opts) : fetchWooCommercePage(storeUrl, opts);
}

export type FetchProductResult =
  | { ok: true; product: FetchedProduct }
  | { ok: false; error: string };

export async function fetchShopifyProduct(storeUrl: string, handle: string, onlyFirstPhoto: boolean): Promise<FetchProductResult> {
  const origin = originOf(storeUrl);
  if (!origin) return { ok: false, error: 'invalid_url: not a valid store URL' };

  const target = `${origin.origin}/products/${encodeURIComponent(handle)}.json`;

  try {
    const res = await safeFetchUrl(target, { maxBytes: MAX_BYTES });
    if (!res.ok) return { ok: false, error: `store_unreachable: /products/${handle}.json returned ${res.status}` };

    let parsed: unknown;
    try {
      parsed = JSON.parse(res.body);
    } catch {
      return { ok: false, error: 'store_invalid: /products/<handle>.json did not return JSON' };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = (parsed as any)?.product;
    if (!raw || typeof raw !== 'object') {
      return { ok: false, error: 'store_invalid: /products/<handle>.json has no "product" object' };
    }

    return { ok: true, product: shopifyProductOf(raw, origin.origin, onlyFirstPhoto) };
  } catch (e) {
    if (e instanceof SafeFetchError) return { ok: false, error: `${e.reason}: ${e.message}` };
    return { ok: false, error: `fetch_failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function fetchWooCommerceProductBySlug(storeUrl: string, slug: string, onlyFirstPhoto: boolean): Promise<FetchProductResult> {
  const origin = originOf(storeUrl);
  if (!origin) return { ok: false, error: 'invalid_url: not a valid store URL' };

  const target = `${origin.origin}/wp-json/wc/store/v1/products?slug=${encodeURIComponent(slug)}`;

  try {
    const res = await safeFetchUrl(target, { maxBytes: MAX_BYTES });
    if (!res.ok) return { ok: false, error: `store_unreachable: Store API returned ${res.status}` };

    let parsed: unknown;
    try {
      parsed = JSON.parse(res.body);
    } catch {
      return { ok: false, error: 'store_invalid: Store API did not return JSON' };
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return { ok: false, error: `store_invalid: no product found for slug "${slug}"` };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = parsed[0] as any;
    const minorUnit = Number(raw?.prices?.currency_minor_unit ?? 2);
    const divisor = Math.pow(10, Number.isFinite(minorUnit) ? minorUnit : 2);

    return { ok: true, product: wooProductOf(raw, divisor, onlyFirstPhoto) };
  } catch (e) {
    if (e instanceof SafeFetchError) return { ok: false, error: `${e.reason}: ${e.message}` };
    return { ok: false, error: `fetch_failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function fetchStoreProduct(
  platform: StorePlatform,
  storeUrl: string,
  handleOrSlug: string,
  onlyFirstPhoto: boolean
): Promise<FetchProductResult> {
  return platform === 'shopify'
    ? fetchShopifyProduct(storeUrl, handleOrSlug, onlyFirstPhoto)
    : fetchWooCommerceProductBySlug(storeUrl, handleOrSlug, onlyFirstPhoto);
}

export type UrlScope = 'store' | 'collection' | 'products';

export type StoreUrlClassification =
  | { scope: 'store'; platform: StorePlatform | null; category: null; handles: [] }
  | { scope: 'collection'; platform: StorePlatform | null; category: string; handles: [] }
  | { scope: 'products'; platform: StorePlatform | null; category: null; handles: string[] };

/**
 * UNA TABELLA, NON UN IF PER PIATTAFORMA: cosa capire da un URL incollato dipende solo dalla sua
 * forma — Shopify ha convenzioni di percorso fisse (`/products/<handle>`, `/collections/<c>`),
 * WooCommerce no (il permalink è configurabile dal negoziante), quindi il riconoscimento di
 * piattaforma dall'URL vale solo per Shopify: un URL Woo torna `platform: null` e la piattaforma
 * resta quella dichiarata sul nodo — non è una perdita, è l'unica cosa che l'URL può dire.
 */
const SHOPIFY_PRODUCT_PATH = /^\/products\/([^/?#]+)\/?$/;
const SHOPIFY_COLLECTION_PATH = /^\/collections\/([^/?#]+)\/?$/;
const SHOPIFY_COLLECTION_PRODUCT_PATH = /^\/collections\/([^/?#]+)\/products\/([^/?#]+)\/?$/;

function classifyOneUrl(raw: string): StoreUrlClassification | null {
  const origin = originOf(raw);
  if (!origin) return null;

  const collectionProduct = origin.pathname.match(SHOPIFY_COLLECTION_PRODUCT_PATH);
  if (collectionProduct) {
    return { scope: 'products', platform: 'shopify', category: null, handles: [decodeURIComponent(collectionProduct[2])] };
  }

  const product = origin.pathname.match(SHOPIFY_PRODUCT_PATH);
  if (product) {
    return { scope: 'products', platform: 'shopify', category: null, handles: [decodeURIComponent(product[1])] };
  }

  const collection = origin.pathname.match(SHOPIFY_COLLECTION_PATH);
  if (collection) {
    return { scope: 'collection', platform: 'shopify', category: decodeURIComponent(collection[1]), handles: [] };
  }

  return { scope: 'store', platform: null, category: null, handles: [] };
}

/**
 * PIÙ URL, UNA RIGA PER VOCE: incollare più prodotti (uno per riga o separati da virgola) resta
 * "products" solo se OGNI voce è un singolo prodotto — un mix di un prodotto e una collezione non
 * ha una lettura sola, e vince la lettura più larga (la collezione), la stessa regola con cui una
 * ricerca con più filtri restringe invece di allargare.
 */
export function classifyStoreUrl(raw: string): StoreUrlClassification {
  const entries = raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (entries.length === 0) {
    return { scope: 'store', platform: null, category: null, handles: [] };
  }

  const classified = entries.map(classifyOneUrl);
  if (classified.some((c) => c === null)) {
    return { scope: 'store', platform: null, category: null, handles: [] };
  }

  const valid = classified as StoreUrlClassification[];
  if (valid.every((c) => c.scope === 'products')) {
    return {
      scope: 'products',
      platform: valid[0].platform,
      category: null,
      handles: valid.flatMap((c) => c.handles)
    };
  }

  const firstNonStore = valid.find((c) => c.scope === 'collection') ?? valid[0];
  return firstNonStore.scope === 'collection'
    ? { scope: 'collection', platform: firstNonStore.platform, category: firstNonStore.category, handles: [] }
    : { scope: 'store', platform: valid[0].platform, category: null, handles: [] };
}
