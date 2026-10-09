import { isShopifySite, isWooCommerceSite } from '@feega/site-analysis/crawl';
import { safeFetchUrl, type SafeFetchResult } from '$lib/server/tool-guard';
import { fetchStoreProduct, fetchStoreProductsPage, type FetchedProduct, type StorePlatform } from '$lib/server/store-fetch';

export enum StoreKind {
  Shopify = 'shopify',
  WooCommerce = 'woocommerce',
  None = 'none'
}

export type StoreProduct = {
  title: string;
  handle: string | null;
  url: string | null;
  price: number | null;
  currency: string | null;
  compare_at_price: number | null;
  images: string[];
  description: string | null;
  options: Record<string, string[]>;
  variants: number;
  available: boolean | null;
  tags: string[];
  product_type: string | null;
};

export type StoreRead = { ok: true; platform: StoreKind; store: string; products: StoreProduct[]; truncated: boolean } | { ok: false; error: string };

type Page = Pick<SafeFetchResult, 'headers' | 'body'>;

type Signals = { header: (headers: Headers) => boolean; page: (html: string) => boolean; probe: string; listed: (json: unknown) => boolean };

const SIGNALS: Record<StorePlatform, Signals> = {
  shopify: {
    header: (h) => /shopify/i.test(h.get('powered-by') ?? '') || h.has('x-shopid') || h.has('x-shopify-stage'),
    page: isShopifySite,
    probe: '/products.json?limit=1',
    listed: (json) => Array.isArray((json as { products?: unknown })?.products)
  },
  woocommerce: {
    header: (h) => /wp-json\/wc\//i.test(h.get('link') ?? '') || h.has('x-wc-store-api-nonce'),
    page: (html) => isWooCommerceSite(html) || /<meta[^>]+content=["']WooCommerce/i.test(html),
    probe: '/wp-json/wc/store/v1/products?per_page=1',
    listed: Array.isArray
  }
};
const PLATFORMS = Object.keys(SIGNALS) as StorePlatform[];

const PAGE_MAX_BYTES = 2_000_000;
const PROBE_MAX_BYTES = 3_000_000;
const PAGE_TIMEOUT_MS = 10_000;
const PAGE_SIZE = 50;
const MAX_PAGES = 4;
export const STORE_ITEMS_DEFAULT = 30;
export const STORE_ITEMS_MAX = 100;
const STORE_DEADLINE_MS = 30_000;
const IMAGES_PER_PRODUCT = 4;
const DESCRIPTION_MAX = 300;
const WEB_SCHEMES = ['http:', 'https:'];

const fetched = (url: string, maxBytes: number) => safeFetchUrl(url, { maxBytes, timeoutMs: PAGE_TIMEOUT_MS }).catch(() => null);

async function listsProducts(origin: string, signals: Signals): Promise<boolean> {
  const res = await fetched(`${origin}${signals.probe}`, PROBE_MAX_BYTES);
  if (!res?.ok) {
    return false;
  }
  try {
    return signals.listed(JSON.parse(res.body));
  } catch {
    return false;
  }
}

export async function storeOf(origin: string, home: Page | null): Promise<StoreKind> {
  const seen = home ? PLATFORMS.find((p) => SIGNALS[p].header(home.headers) || SIGNALS[p].page(home.body)) : undefined;
  if (seen) {
    return seen as StoreKind;
  }
  for (const platform of PLATFORMS) {
    if (await listsProducts(origin, SIGNALS[platform])) {
      return platform as StoreKind;
    }
  }
  return StoreKind.None;
}

function originOf(input: string): string | null {
  const trimmed = input.trim();
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) || /^[a-z][a-z0-9+.-]*:[^\d]/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (!URL.canParse(withScheme)) {
    return null;
  }
  const url = new URL(withScheme);
  return WEB_SCHEMES.includes(url.protocol) ? url.origin : null;
}

export async function detectStore(input: string): Promise<StoreKind> {
  const origin = originOf(input);
  if (!origin) {
    return StoreKind.None;
  }
  return storeOf(origin, await fetched(`${origin}/`, PAGE_MAX_BYTES));
}

const plain = (html: string | null) => (html ? html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, DESCRIPTION_MAX) || null : null);

export function storeProduct(p: FetchedProduct): StoreProduct {
  return {
    title: p.title,
    handle: p.handle,
    url: p.url,
    price: p.price,
    currency: p.currency,
    compare_at_price: p.compareAtPrice,
    images: p.images.slice(0, IMAGES_PER_PRODUCT).map((i) => i.url),
    description: plain(p.description),
    options: p.options,
    variants: p.variants.length,
    available: p.available,
    tags: [...new Set([...(p.productType ? [p.productType] : []), ...p.tags])],
    product_type: p.productType
  };
}

export async function listStore(platform: StorePlatform, origin: string, opts: { max: number; category?: string }): Promise<{ products: FetchedProduct[]; truncated: boolean } | { error: string }> {
  const deadline = Date.now() + STORE_DEADLINE_MS;
  const products: FetchedProduct[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES && products.length < opts.max && Date.now() < deadline; page++) {
    const read = await fetchStoreProductsPage(platform, origin, { limit: PAGE_SIZE, after, onlyFirstPhoto: false, category: opts.category });
    if (!read.ok) {
      return products.length ? { products, truncated: true } : { error: read.error };
    }
    products.push(...read.products);
    after = read.after;
    if (!after) {
      return { products: products.slice(0, opts.max), truncated: products.length > opts.max };
    }
  }
  return { products: products.slice(0, opts.max), truncated: true };
}

export async function readStore(input: string, opts: { max?: number; category?: string; home?: Page } = {}): Promise<StoreRead> {
  const origin = originOf(input);
  if (!origin) {
    return { ok: false, error: 'only http and https sites can be read' };
  }
  const platform = await storeOf(origin, opts.home ?? (await fetched(`${origin}/`, PAGE_MAX_BYTES)));
  if (platform === StoreKind.None) {
    return { ok: true, platform, store: origin, products: [], truncated: false };
  }
  const listed = await listStore(platform as StorePlatform, origin, { max: Math.min(opts.max ?? STORE_ITEMS_DEFAULT, STORE_ITEMS_MAX), category: opts.category });
  if ('error' in listed) {
    return { ok: false, error: `the ${platform} store did not list its products: ${listed.error}` };
  }
  return { ok: true, platform, store: origin, products: listed.products.map(storeProduct), truncated: listed.truncated };
}

export async function storeProducts(input: string, handles: string[]): Promise<{ ok: true; platform: StorePlatform; products: FetchedProduct[]; missing: string[] } | { ok: false; error: string }> {
  const origin = originOf(input);
  const platform = origin ? await detectStore(origin) : StoreKind.None;
  if (!origin || platform === StoreKind.None) {
    return { ok: false, error: 'not a Shopify or WooCommerce store' };
  }
  const read = await Promise.all(handles.map((h) => fetchStoreProduct(platform as StorePlatform, origin, h, false)));
  return {
    ok: true,
    platform: platform as StorePlatform,
    products: read.flatMap((r) => (r.ok ? [r.product] : [])),
    missing: handles.filter((_, i) => !read[i].ok)
  };
}
