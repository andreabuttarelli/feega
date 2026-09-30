import type { ProductOptions, ProductVariant } from '$lib/canvas/product-shape';

export type StorePlatform = 'shopify' | 'woocommerce';

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
  compareAtPrice: number | null;
  tags: string[];
  vendor: string | null;
  productType: string | null;
  sku: string | null;
  variants: ProductVariant[];
  options: ProductOptions;
};

export type NormaliseContext = { origin: string; divisor: number; onlyFirstPhoto: boolean };

function limitPhotos(images: FetchedProduct['images'], onlyFirst: boolean): FetchedProduct['images'] {
  return onlyFirst ? images.slice(0, 1) : images;
}

const SHOPIFY_OPTION_SLOTS = ['option1', 'option2', 'option3'] as const;

const textOr = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

const amountOr = (value: unknown, divisor = 1): number | null => {
  if (value == null || value === '') {
    return null;
  }
  const n = Number(value) / divisor;
  return Number.isFinite(n) ? n : null;
};

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const cleanTags = (tags: unknown[]): string[] => tags.map(textOr).filter((t): t is string => t !== null);

const shopifyTags = (tags: unknown): string[] => cleanTags(typeof tags === 'string' ? tags.split(',') : list(tags));

const namesOf = (items: unknown): string[] => cleanTags(list(items).map((item) => (item as { name?: unknown })?.name));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shopifyOptions(raw: any): ProductOptions {
  return Object.fromEntries(
    list(raw.options)
      .map((o) => o as { name?: unknown; values?: unknown })
      .filter((o) => textOr(o.name))
      .map((o) => [textOr(o.name) as string, cleanTags(list(o.values))])
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shopifyVariant(v: any, optionNames: string[]): ProductVariant {
  const options = Object.fromEntries(
    optionNames.flatMap((name, i) => {
      const value = textOr(v[SHOPIFY_OPTION_SLOTS[i]]);
      return value ? [[name, value]] : [];
    })
  );
  return {
    id: String(v.id ?? ''),
    title: String(v.title ?? ''),
    sku: textOr(v.sku),
    price: amountOr(v.price),
    compare_at_price: amountOr(v.compare_at_price),
    available: typeof v.available === 'boolean' ? v.available : null,
    options,
    image: textOr(v.featured_image?.src)
  };
}

const anyAvailable = (variants: ProductVariant[]): boolean | null =>
  variants.some((v) => v.available !== null) ? variants.some((v) => v.available === true) : null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wooOptions(raw: any): ProductOptions {
  return Object.fromEntries(
    list(raw.attributes)
      .map((a) => a as { name?: unknown; terms?: unknown })
      .filter((a) => textOr(a.name))
      .map((a) => [textOr(a.name) as string, namesOf(a.terms)])
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wooVariant(v: any): ProductVariant {
  const pairs = list(v.attributes)
    .map((a) => a as { name?: unknown; value?: unknown })
    .map((a) => [textOr(a.name), textOr(a.value)] as const)
    .filter((pair): pair is readonly [string, string] => pair[0] !== null && pair[1] !== null);
  return {
    id: String(v.id ?? ''),
    title: pairs.map(([, value]) => value).join(' / '),
    sku: null,
    price: null,
    compare_at_price: null,
    available: null,
    options: Object.fromEntries(pairs),
    image: null
  };
}

function stripHtml(html: unknown): string | null {
  const text = String(html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text || null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shopifyProductOf(raw: any, { origin, onlyFirstPhoto }: NormaliseContext): FetchedProduct {
  const variant = Array.isArray(raw.variants) ? raw.variants[0] : undefined;
  const images: FetchedProduct['images'] = Array.isArray(raw.images)
    ? raw.images
        .map((img: unknown, i: number) => {
          const src = typeof img === 'string' ? img : (img as { src?: string })?.src;
          return src ? { url: src, position: i } : null;
        })
        .filter((x: unknown): x is FetchedProduct['images'][number] => x !== null)
    : [];

  const optionNames = Object.keys(shopifyOptions(raw));
  const variants = list(raw.variants).map((v) => shopifyVariant(v, optionNames));
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
    available: typeof raw.available === 'boolean' ? raw.available : anyAvailable(variants),
    compareAtPrice: amountOr(variant?.compare_at_price),
    tags: shopifyTags(raw.tags),
    vendor: textOr(raw.vendor),
    productType: textOr(raw.product_type),
    sku: textOr(variant?.sku),
    variants,
    options: shopifyOptions(raw)
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wooProductOf(raw: any, { divisor, onlyFirstPhoto }: NormaliseContext): FetchedProduct {
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
    available: typeof raw.is_in_stock === 'boolean' ? raw.is_in_stock : null,
    compareAtPrice: raw.on_sale === true ? amountOr(raw.prices?.regular_price, divisor) : null,
    tags: namesOf(raw.tags),
    vendor: namesOf(raw.brands)[0] ?? null,
    productType: namesOf(raw.categories)[0] ?? null,
    sku: textOr(raw.sku),
    variants: list(raw.variations).map(wooVariant),
    options: wooOptions(raw)
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PRODUCT_NORMALISERS: Record<StorePlatform, (raw: any, ctx: NormaliseContext) => FetchedProduct> = {
  shopify: shopifyProductOf,
  woocommerce: wooProductOf
};

export function normaliseProduct(platform: StorePlatform, raw: unknown, ctx: NormaliseContext): FetchedProduct {
  return PRODUCT_NORMALISERS[platform](raw, ctx);
}

export const NO_COMMERCE_FIELDS = {
  compareAtPrice: null,
  tags: [],
  vendor: null,
  productType: null,
  sku: null,
  variants: [],
  options: {}
} satisfies Partial<FetchedProduct>;
