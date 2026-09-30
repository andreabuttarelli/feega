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
};

export type NormaliseContext = { origin: string; divisor: number; onlyFirstPhoto: boolean };

function limitPhotos(images: FetchedProduct['images'], onlyFirst: boolean): FetchedProduct['images'] {
  return onlyFirst ? images.slice(0, 1) : images;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PRODUCT_NORMALISERS: Record<StorePlatform, (raw: any, ctx: NormaliseContext) => FetchedProduct> = {
  shopify: shopifyProductOf,
  woocommerce: wooProductOf
};

export function normaliseProduct(platform: StorePlatform, raw: unknown, ctx: NormaliseContext): FetchedProduct {
  return PRODUCT_NORMALISERS[platform](raw, ctx);
}
