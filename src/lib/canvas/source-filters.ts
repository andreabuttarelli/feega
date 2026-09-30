import { discountPercent } from './product-discount';

export const PRODUCT_SORTS = ['newest', 'price_asc', 'price_desc', 'title'] as const;
export const FEED_SORTS = ['newest', 'most_liked', 'most_viewed'] as const;
export const FEED_MEDIA = ['all', 'image', 'video', 'carousel'] as const;

export type ProductSort = (typeof PRODUCT_SORTS)[number];
export type FeedSort = (typeof FEED_SORTS)[number];
export type FeedMedia = (typeof FEED_MEDIA)[number];

export type ProductFilters = {
  query: string;
  price_min: number | null;
  price_max: number | null;
  in_stock_only: boolean;
  on_sale_only: boolean;
  tag: string;
  vendor: string;
  product_type: string;
  sort: ProductSort;
};

export type FeedFilters = {
  from: string | null;
  to: string | null;
  media: FeedMedia;
  min_likes: number | null;
  min_views: number | null;
  include: string;
  exclude: string;
  sort: FeedSort;
};

export const DEFAULT_PRODUCT_FILTERS: ProductFilters = {
  query: '',
  price_min: null,
  price_max: null,
  in_stock_only: false,
  on_sale_only: false,
  tag: '',
  vendor: '',
  product_type: '',
  sort: 'newest'
};

export const DEFAULT_FEED_FILTERS: FeedFilters = {
  from: null,
  to: null,
  media: 'all',
  min_likes: null,
  min_views: null,
  include: '',
  exclude: '',
  sort: 'newest'
};

type FilterableProduct = {
  title: string;
  description: string | null;
  price: number | null;
  available: boolean | null;
  compareAtPrice?: number | null;
  tags?: string[];
  vendor?: string | null;
  productType?: string | null;
};
type FilterablePost = {
  caption: string | null;
  postedAt: string | null;
  metrics: Record<string, unknown> | null;
  media: Record<string, unknown> | null;
};

const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const text = (v: unknown): string => (typeof v === 'string' ? v : '');
const amount = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const day = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const oneOf = <T extends string>(values: readonly T[], v: unknown, fallback: T): T =>
  typeof v === 'string' && (values as readonly string[]).includes(v) ? (v as T) : fallback;

export function productFiltersOf(raw: unknown): ProductFilters {
  const f = record(raw);
  return {
    query: text(f.query),
    price_min: amount(f.price_min),
    price_max: amount(f.price_max),
    in_stock_only: f.in_stock_only === true,
    on_sale_only: f.on_sale_only === true,
    tag: text(f.tag),
    vendor: text(f.vendor),
    product_type: text(f.product_type),
    sort: oneOf(PRODUCT_SORTS, f.sort, DEFAULT_PRODUCT_FILTERS.sort)
  };
}

export function feedFiltersOf(raw: unknown): FeedFilters {
  const f = record(raw);
  return {
    from: day(f.from),
    to: day(f.to),
    media: oneOf(FEED_MEDIA, f.media, DEFAULT_FEED_FILTERS.media),
    min_likes: amount(f.min_likes),
    min_views: amount(f.min_views),
    include: text(f.include),
    exclude: text(f.exclude),
    sort: oneOf(FEED_SORTS, f.sort, DEFAULT_FEED_FILTERS.sort)
  };
}

const withPriceLast = (a: number | null, b: number | null, direction: number): number => {
  if (a === null) {
    return b === null ? 0 : 1;
  }
  if (b === null) {
    return -1;
  }
  return (a - b) * direction;
};

const PRODUCT_ORDER: Record<ProductSort, ((a: FilterableProduct, b: FilterableProduct) => number) | null> = {
  newest: null,
  price_asc: (a, b) => withPriceLast(a.price, b.price, 1),
  price_desc: (a, b) => withPriceLast(a.price, b.price, -1),
  title: (a, b) => a.title.localeCompare(b.title)
};

const same = (wanted: string) => {
  const target = wanted.trim().toLowerCase();
  return (value: string | null | undefined): boolean => !target || value?.trim().toLowerCase() === target;
};

export function filterProducts<T extends FilterableProduct>(items: T[], f: ProductFilters): T[] {
  const query = f.query.trim().toLowerCase();
  const tagMatches = same(f.tag);
  const vendorMatches = same(f.vendor);
  const typeMatches = same(f.product_type);
  const kept = items.filter((p) => {
    if (f.tag.trim() && !(p.tags ?? []).some(tagMatches)) {
      return false;
    }
    if (!vendorMatches(p.vendor) || !typeMatches(p.productType)) {
      return false;
    }
    if (f.on_sale_only && discountPercent(p.price, p.compareAtPrice) === null) {
      return false;
    }
    if (query && !`${p.title}\n${p.description ?? ''}`.toLowerCase().includes(query)) {
      return false;
    }
    if (f.price_min !== null && (p.price === null || p.price < f.price_min)) {
      return false;
    }
    if (f.price_max !== null && (p.price === null || p.price > f.price_max)) {
      return false;
    }
    return !(f.in_stock_only && p.available === false);
  });

  const order = PRODUCT_ORDER[f.sort];
  return order ? kept.sort(order) : kept;
}

export function mediaKindOf(media: Record<string, unknown> | null): Exclude<FeedMedia, 'all'> {
  const items = Array.isArray(media?.items) ? (media.items as Record<string, unknown>[]) : [];
  if (items.length > 1) {
    return 'carousel';
  }
  return media?.type === 'video' || items[0]?.type === 'video' ? 'video' : 'image';
}

const metric = (post: FilterablePost, key: string): number | null => amount(post.metrics?.[key]);
const keywords = (list: string): string[] =>
  list
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
const byMetric = (key: string) => (a: FilterablePost, b: FilterablePost) => (metric(b, key) ?? -1) - (metric(a, key) ?? -1);

const FEED_ORDER: Record<FeedSort, (a: FilterablePost, b: FilterablePost) => number> = {
  newest: (a, b) => (b.postedAt ?? '').localeCompare(a.postedAt ?? ''),
  most_liked: byMetric('likes'),
  most_viewed: byMetric('views')
};

function atLeast(value: number | null, min: number | null): boolean {
  return min === null || (value !== null && value >= min);
}

export function filterPosts<T extends FilterablePost>(items: T[], f: FeedFilters): T[] {
  const include = keywords(f.include);
  const exclude = keywords(f.exclude);

  const kept = items.filter((p) => {
    const date = p.postedAt?.slice(0, 10) ?? null;
    if ((f.from || f.to) && !date) {
      return false;
    }
    if ((f.from && date! < f.from) || (f.to && date! > f.to)) {
      return false;
    }
    if (f.media !== 'all' && mediaKindOf(p.media) !== f.media) {
      return false;
    }
    if (!atLeast(metric(p, 'likes'), f.min_likes) || !atLeast(metric(p, 'views'), f.min_views)) {
      return false;
    }
    const caption = (p.caption ?? '').toLowerCase();
    if (include.length && !include.some((k) => caption.includes(k))) {
      return false;
    }
    return !exclude.some((k) => caption.includes(k));
  });

  return kept.sort(FEED_ORDER[f.sort]);
}

const PROFILE_PATH_PREFIXES = new Set(['c', 'user', 'u', 'in', 'company', 'channel']);

export function normalizeHandle(raw: string): string {
  const value = raw.trim();
  if (!value.includes('/')) {
    return value.replace(/^@/, '');
  }

  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  let path: string[];
  try {
    path = new URL(withScheme).pathname.split('/').filter(Boolean);
  } catch {
    return value.replace(/^@/, '');
  }

  const segment = path.find((s) => !PROFILE_PATH_PREFIXES.has(s.toLowerCase())) ?? '';
  return decodeURIComponent(segment).replace(/^@/, '');
}
