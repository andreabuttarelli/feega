import { normalizeUrl } from '$lib/ads-fee';
import { productsData, productsOf, socialFeedData, socialFeedOf, type NodeRow } from '$lib/canvas-node-data';
import { PRODUCT_PLATFORMS } from './products-node';
import { SOCIAL_FEED_PLATFORMS } from './social-feed-node';
import { canStartSync, type SyncNode } from './sync-state';
import { FEED_MEDIA, FEED_SORTS, PRODUCT_SORTS, normalizeHandle } from './source-filters';

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
  newest: 'Più recenti',
  price_asc: 'Prezzo crescente',
  price_desc: 'Prezzo decrescente',
  title: 'Titolo A–Z',
  most_liked: 'Più like',
  most_viewed: 'Più visualizzati',
  all: 'Tutti',
  image: 'Immagini',
  video: 'Video',
  carousel: 'Caroselli'
};

const options = (values: readonly string[], labels: Record<string, string>): Option[] =>
  values.map((value) => ({ value, label: labels[value] ?? value }));

export const PRODUCT_FIELDS: readonly FieldSpec[] = [
  { path: 'platform', label: 'Piattaforma', kind: FieldKind.Select, appliesAt: AppliesAt.Fetch, options: options(PRODUCT_PLATFORMS, PLATFORM_LABELS) },
  { path: 'url', label: 'Indirizzo dello store', kind: FieldKind.Text, appliesAt: AppliesAt.Fetch, placeholder: 'store.example.com', normalize: normalizeUrl },
  { path: 'limit', label: 'Quanti prodotti', kind: FieldKind.Number, appliesAt: AppliesAt.Fetch, required: true },
  { path: 'onlyFirstPhoto', label: 'Solo la prima foto', kind: FieldKind.Toggle, appliesAt: AppliesAt.Fetch },
  { path: 'category', label: 'Categoria / collezione', kind: FieldKind.Text, appliesAt: AppliesAt.Fetch, placeholder: 'es. summer-sale' },
  { path: 'filters.query', label: 'Titolo o descrizione contiene', kind: FieldKind.Text, appliesAt: AppliesAt.Read },
  { path: 'filters.price_min', label: 'Prezzo minimo', kind: FieldKind.Number, appliesAt: AppliesAt.Read },
  { path: 'filters.price_max', label: 'Prezzo massimo', kind: FieldKind.Number, appliesAt: AppliesAt.Read },
  { path: 'filters.in_stock_only', label: 'Solo disponibili', kind: FieldKind.Toggle, appliesAt: AppliesAt.Read },
  { path: 'filters.sort', label: 'Ordina per', kind: FieldKind.Select, appliesAt: AppliesAt.Read, options: options(PRODUCT_SORTS, OPTION_LABELS) }
];

export const FEED_FIELDS: readonly FieldSpec[] = [
  { path: 'platform', label: 'Piattaforma', kind: FieldKind.Select, appliesAt: AppliesAt.Fetch, options: options(SOCIAL_FEED_PLATFORMS, PLATFORM_LABELS) },
  { path: 'handle', label: 'Account', kind: FieldKind.Text, appliesAt: AppliesAt.Fetch, placeholder: '@nike o URL del profilo', normalize: normalizeHandle },
  { path: 'limit', label: 'Quanti post', kind: FieldKind.Number, appliesAt: AppliesAt.Fetch, required: true },
  { path: 'filters.from', label: 'Dal', kind: FieldKind.Date, appliesAt: AppliesAt.Read },
  { path: 'filters.to', label: 'Al', kind: FieldKind.Date, appliesAt: AppliesAt.Read },
  { path: 'filters.media', label: 'Tipo di media', kind: FieldKind.Select, appliesAt: AppliesAt.Read, options: options(FEED_MEDIA, OPTION_LABELS) },
  { path: 'filters.min_likes', label: 'Like minimi', kind: FieldKind.Number, appliesAt: AppliesAt.Read },
  { path: 'filters.min_views', label: 'Visualizzazioni minime', kind: FieldKind.Number, appliesAt: AppliesAt.Read },
  { path: 'filters.include', label: 'La didascalia contiene', kind: FieldKind.Text, appliesAt: AppliesAt.Read, placeholder: 'parole, separate da virgola' },
  { path: 'filters.exclude', label: 'La didascalia non contiene', kind: FieldKind.Text, appliesAt: AppliesAt.Read, placeholder: 'parole, separate da virgola' },
  { path: 'filters.sort', label: 'Ordina per', kind: FieldKind.Select, appliesAt: AppliesAt.Read, options: options(FEED_SORTS, OPTION_LABELS) }
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
  dataWith: (path: string, value: unknown) => Record<string, unknown>;
};

function view<N extends SyncNode>(
  title: string,
  fields: readonly FieldSpec[],
  node: N,
  ready: boolean,
  toData: (node: N) => Record<string, unknown>
): InspectorView {
  return {
    title,
    fields,
    values: node as unknown as Record<string, unknown>,
    sync: node,
    canSync: ready && canStartSync(node),
    syncCredits: 0,
    dataWith: (path, value) => toData(withValue(node, path, value))
  };
}

const INSPECTORS: Record<string, (row: NodeRow) => InspectorView | null> = {
  products: (row) => {
    const node = productsOf(row);
    return node && view('Prodotti', PRODUCT_FIELDS, node, node.url.trim().length > 0, productsData);
  },
  social_account_feed: (row) => {
    const node = socialFeedOf(row);
    return node && view('Feed social', FEED_FIELDS, node, node.handle.trim().length > 0, socialFeedData);
  }
};

export function inspectorOf(row: NodeRow): InspectorView | null {
  return INSPECTORS[row.type]?.(row) ?? null;
}
