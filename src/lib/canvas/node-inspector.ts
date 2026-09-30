import { normalizeUrl } from '$lib/ads-fee';
import { productsData, productsOf, socialFeedData, socialFeedOf, type NodeRow } from '$lib/canvas-node-data';
import { PRODUCT_PLATFORMS } from './products-node';
import { isSocialFeedPlatform, SOCIAL_FEED_PLATFORMS, type SocialFeedPlatform } from './social-feed-node';
import { canStartSync, type SyncNode } from './sync-state';
import { FEED_MEDIA, FEED_SORTS, PRODUCT_SORTS, normalizeHandle } from './source-filters';
import { classifySocialLines } from './social-url-classifier';

export enum FieldKind {
  Select = 'select',
  Text = 'text',
  Number = 'number',
  Toggle = 'toggle',
  Date = 'date'
}

export enum AppliesAt {
  Fetch = 'fetch',
  Read = 'read'
}

type Option = { value: string; label: string };

export type FieldSpec = {
  path: string;
  label: string;
  kind: FieldKind;
  appliesAt: AppliesAt;
  options?: readonly Option[];
  placeholder?: string;
  required?: boolean;
  normalize?: (raw: string) => string;
};

const PLATFORM_LABELS: Record<string, string> = {
  shopify: 'Shopify',
  woocommerce: 'WooCommerce',
  instagram: 'Instagram',
  facebook: 'Facebook',
  x: 'X',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  threads: 'Threads',
  youtube: 'YouTube',
  reddit: 'Reddit',
  pinterest: 'Pinterest'
};

const OPTION_LABELS: Record<string, string> = {
  newest: 'Newest',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  title: 'Title A–Z',
  most_liked: 'Most liked',
  most_viewed: 'Most viewed',
  all: 'All',
  image: 'Images',
  video: 'Video',
  carousel: 'Carousels'
};

const options = (values: readonly string[], labels: Record<string, string>): Option[] =>
  values.map((value) => ({ value, label: labels[value] ?? value }));

export const PRODUCT_FIELDS: readonly FieldSpec[] = [
  { path: 'platform', label: 'Platform', kind: FieldKind.Select, appliesAt: AppliesAt.Fetch, options: options(PRODUCT_PLATFORMS, PLATFORM_LABELS) },
  { path: 'url', label: 'Store address', kind: FieldKind.Text, appliesAt: AppliesAt.Fetch, placeholder: 'store.example.com', normalize: normalizeUrl },
  { path: 'limit', label: 'Number of products', kind: FieldKind.Number, appliesAt: AppliesAt.Fetch, required: true },
  { path: 'onlyFirstPhoto', label: 'First photo only', kind: FieldKind.Toggle, appliesAt: AppliesAt.Fetch },
  { path: 'category', label: 'Category / collection', kind: FieldKind.Text, appliesAt: AppliesAt.Fetch, placeholder: 'e.g. summer-sale' },
  { path: 'filters.query', label: 'Title or description contains', kind: FieldKind.Text, appliesAt: AppliesAt.Read },
  { path: 'filters.price_min', label: 'Minimum price', kind: FieldKind.Number, appliesAt: AppliesAt.Read },
  { path: 'filters.price_max', label: 'Maximum price', kind: FieldKind.Number, appliesAt: AppliesAt.Read },
  { path: 'filters.in_stock_only', label: 'In stock only', kind: FieldKind.Toggle, appliesAt: AppliesAt.Read },
  { path: 'filters.on_sale_only', label: 'On sale only', kind: FieldKind.Toggle, appliesAt: AppliesAt.Read },
  { path: 'filters.tag', label: 'Tag', kind: FieldKind.Text, appliesAt: AppliesAt.Read, placeholder: 'e.g. summer' },
  { path: 'filters.vendor', label: 'Vendor', kind: FieldKind.Text, appliesAt: AppliesAt.Read },
  { path: 'filters.product_type', label: 'Product type', kind: FieldKind.Text, appliesAt: AppliesAt.Read },
  { path: 'filters.sort', label: 'Sort by', kind: FieldKind.Select, appliesAt: AppliesAt.Read, options: options(PRODUCT_SORTS, OPTION_LABELS) }
];

export const FEED_FIELDS: readonly FieldSpec[] = [
  { path: 'platform', label: 'Platform', kind: FieldKind.Select, appliesAt: AppliesAt.Fetch, options: options(SOCIAL_FEED_PLATFORMS, PLATFORM_LABELS) },
  { path: 'handle', label: 'Account', kind: FieldKind.Text, appliesAt: AppliesAt.Fetch, placeholder: '@nike or profile URL', normalize: normalizeHandle },
  { path: 'limit', label: 'Number of posts', kind: FieldKind.Number, appliesAt: AppliesAt.Fetch, required: true },
  { path: 'filters.from', label: 'From', kind: FieldKind.Date, appliesAt: AppliesAt.Read },
  { path: 'filters.to', label: 'To', kind: FieldKind.Date, appliesAt: AppliesAt.Read },
  { path: 'filters.media', label: 'Media type', kind: FieldKind.Select, appliesAt: AppliesAt.Read, options: options(FEED_MEDIA, OPTION_LABELS) },
  { path: 'filters.min_likes', label: 'Minimum likes', kind: FieldKind.Number, appliesAt: AppliesAt.Read },
  { path: 'filters.min_views', label: 'Minimum views', kind: FieldKind.Number, appliesAt: AppliesAt.Read },
  { path: 'filters.include', label: 'Caption contains', kind: FieldKind.Text, appliesAt: AppliesAt.Read, placeholder: 'words, comma separated' },
  { path: 'filters.exclude', label: 'Caption does not contain', kind: FieldKind.Text, appliesAt: AppliesAt.Read, placeholder: 'words, comma separated' },
  { path: 'filters.sort', label: 'Sort by', kind: FieldKind.Select, appliesAt: AppliesAt.Read, options: options(FEED_SORTS, OPTION_LABELS) }
];

export function inputValueOf(values: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((at, key) => (at && typeof at === 'object' ? (at as Record<string, unknown>)[key] : undefined), values);
}

function withValue<T extends object>(values: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split('.');
  const current = (values as Record<string, unknown>)[head];
  const next = rest.length ? withValue((current ?? {}) as object, rest.join('.'), value) : value;
  return { ...values, [head]: next };
}

const PARSERS: Record<FieldKind, (field: FieldSpec, raw: string | boolean) => unknown> = {
  [FieldKind.Toggle]: (_field, raw) => raw === true,
  [FieldKind.Select]: (_field, raw) => String(raw),
  [FieldKind.Text]: (field, raw) => (field.normalize ? field.normalize(String(raw)) : String(raw)),
  [FieldKind.Date]: (_field, raw) => (String(raw) ? String(raw) : null),
  [FieldKind.Number]: (field, raw) => {
    const text = String(raw).trim();
    if (!text) {
      return field.required ? undefined : null;
    }
    const n = Number(text);
    if (!Number.isFinite(n) || n < 0 || (field.required && n < 1)) {
      return undefined;
    }
    return field.required ? Math.floor(n) : n;
  }
};

export function parseFieldInput(field: FieldSpec, raw: string | boolean): unknown {
  return PARSERS[field.kind](field, raw);
}

export type InspectorView = {
  title: string;
  fields: readonly FieldSpec[];
  values: Record<string, unknown>;
  sync: SyncNode;
  canSync: boolean;
  syncCredits: number;
  syncSummary: string | null;
  dataWith: (path: string, value: unknown) => Record<string, unknown>;
};

function view<N extends SyncNode>(
  title: string,
  fields: readonly FieldSpec[],
  node: N,
  ready: boolean,
  toData: (node: N) => Record<string, unknown>,
  syncSummary: string | null = null
): InspectorView {
  return {
    title,
    fields,
    values: node as unknown as Record<string, unknown>,
    sync: node,
    canSync: ready && canStartSync(node),
    syncCredits: 0,
    syncSummary,
    dataWith: (path, value) => toData(withValue(node, path, value))
  };
}

const INSPECTORS: Record<string, (row: NodeRow) => InspectorView | null> = {
  products: (row) => {
    const node = productsOf(row);
    return node && view('Products', PRODUCT_FIELDS, node, node.url.trim().length > 0, productsData, node.syncSummary);
  },
  social_account_feed: (row) => {
    const node = socialFeedOf(row);
    return node && view('Social feed', FEED_FIELDS, node, node.handle.trim().length > 0, socialFeedData, node.syncSummary);
  }
};

export function hasInspector(type: string): boolean {
  return type in INSPECTORS;
}

export function inspectorOf(row: NodeRow): InspectorView | null {
  return INSPECTORS[row.type]?.(row) ?? null;
}

const PLATFORM_LABEL_OF: Record<SocialFeedPlatform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  x: 'X',
  threads: 'Threads',
  facebook: 'Facebook',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  reddit: 'Reddit',
  pinterest: 'Pinterest'
};

function summaryOf(platform: string, kind: 'profile' | 'post' | 'hashtag', handleOrId: string | null): string {
  const label = isSocialFeedPlatform(platform) ? PLATFORM_LABEL_OF[platform] : platform;
  if (kind === 'post') {
    return `${label} · 1 post`;
  }
  if (kind === 'hashtag') {
    return `${label} · hashtag #${handleOrId}`;
  }
  return `${label} · profile @${handleOrId}`;
}

/**
 * IL CAMPO `handle` DEL FEED CAPISCE DA SOLO COSA GLI È STATO INCOLLATO — un handle nudo, l'URL di
 * un profilo, l'URL di un singolo post/video, un hashtag, o più righe insieme. Un URL di PROFILO
 * riconosciuto normalizza il campo al solo handle e imposta anche `platform` — l'unico caso il cui
 * commit tocca due colonne insieme, quindi vive qui e non in `parseFieldInput`, che ne scrive una
 * sola. Un handle nudo senza dominio non tocca `platform`: la scelta manuale resta l'unico modo di
 * dire quale piattaforma, perché il testo da solo non lo dice. Un post, un hashtag o più righe
 * insieme restano SCRITTI COSÌ COME SONO — `syncSocialFeedEntries` (lato server) li riclassifica
 * uno per uno alla sincronizzazione, ognuno con la sua vera piattaforma — e il riassunto qui è solo
 * un'anteprima di quel che capirà. Solo un input che non classifica NULLA (dominio sconosciuto,
 * reddit/pinterest) lascia l'handle precedente intatto e dice perché in `sync_error`.
 */
export function commitHandleField(view: InspectorView, raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ...view.dataWith('handle', ''), sync_summary: null, sync_error: null };
  }

  const { entries, errors } = classifySocialLines(trimmed);
  if (!entries.length) {
    return { ...view.values, sync_error: errors[0]?.message ?? `could not recognize "${trimmed}"` };
  }

  if (entries.length > 1) {
    const summary = entries.map((e) => summaryOf(e.platform, e.kind, e.handle ?? e.id)).join(' · ');
    return { ...view.dataWith('handle', raw), sync_summary: summary, sync_error: null };
  }

  const entry = entries[0];
  const isSingleUrl = /^https?:\/\//i.test(trimmed) || (trimmed.includes('.') && trimmed.includes('/'));
  const summary = summaryOf(entry.platform, entry.kind, entry.handle ?? entry.id);

  if (entry.kind === 'profile' && isSingleUrl) {
    const data = view.dataWith('handle', entry.handle ?? '');
    return { ...data, platform: entry.platform, sync_summary: summary, sync_error: null };
  }

  if (entry.kind === 'profile') {
    // A bare handle carries no domain to detect a platform from — the classifier defaults it to
    // instagram, but the user's already-chosen `platform` field is the real override here.
    return { ...view.dataWith('handle', entry.handle ?? ''), sync_summary: null, sync_error: null };
  }

  return { ...view.dataWith('handle', raw), sync_summary: summary, sync_error: null };
}
