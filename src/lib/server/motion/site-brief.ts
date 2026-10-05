import {
  extractColorsFromImage,
  extractSocialHandles,
  fetchShopifyProducts,
  fetchWooCommerceProducts,
  harvestPageImages,
  isShopifySite,
  isWooCommerceSite,
  parseHTMLMetadata
} from '@feega/site-analysis/crawl';
import { safeFetchBytes, safeFetchUrl } from '$lib/server/tool-guard';
import { probeImageDimensions } from '$lib/server/brand-media';
import { GOOGLE_FONTS } from '$lib/motion/fonts/catalogue';

export const PAGE_MAX_BYTES = 2_000_000;
const PAGE_TIMEOUT_MS = 10_000;
const SITE_DEADLINE_MS = 30_000;
const LOGO_SVG_MAX_BYTES = 500_000;
const IMAGE_MAX_BYTES = 8_000_000;
const IMAGE_TIMEOUT_MS = 6_000;
const IMAGES_PROBED = 12;
const IMAGES_KEPT = 8;
const MIN_IMAGE_EDGE = 300;
const PALETTE_MAX = 8;
const PRODUCTS_MAX = 8;
const TAGLINE_MAX = 120;
const HTML_TYPES = ['text/html', 'application/xhtml+xml'];

export enum ImageRole {
  Og = 'og',
  Hero = 'hero',
  Product = 'product'
}

export enum LogoKind {
  Svg = 'svg',
  Raster = 'raster'
}

export type SiteLogo = { url: string; kind: LogoKind; source: string };
export type SiteImage = { url: string; width: number; height: number; role: ImageRole };
export type SiteFont = { family: string; google: boolean };
export type SiteProduct = { name: string; price: string | null; url: string | null; image: string | null };
export type SiteBrief = {
  url: string;
  name: string;
  tagline: string | null;
  description: string | null;
  logos: SiteLogo[];
  palette: string[];
  fonts: SiteFont[];
  images: SiteImage[];
  products: SiteProduct[];
  socials: { platform: string; url: string }[];
};
export type SiteRead = { ok: true; site: SiteBrief } | { ok: false; error: string };

const HEX = /#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi;
const SVG_URL = /\.svg(?:[?#]|$)/i;
const TITLE_SEPARATOR = /\s+[|–—:·-]\s+/;
const GOOGLE_FAMILIES = new Map(GOOGLE_FONTS.map((f) => [f.f.toLowerCase(), f.f]));

const errorOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

function fullHex(hex: string): string {
  const h = hex.slice(1).toUpperCase();
  return h.length === 3 ? `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}` : `#${h}`;
}

const hexesIn = (text: string) => (text.match(HEX) ?? []).map(fullHex);

function metaContent(html: string, property: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`, 'i');
  return (html.match(re)?.[1] ?? html.match(re2)?.[1])?.trim() || null;
}

function linkHref(html: string, rel: string, base: string): string | null {
  const href = html.match(new RegExp(`<link[^>]+rel=["']${rel}["'][^>]*href=["']([^"']+)["']`, 'i'))?.[1] ?? html.match(new RegExp(`<link[^>]+href=["']([^"']+)["'][^>]*rel=["']${rel}["']`, 'i'))?.[1];
  return href ? new URL(href, base).href : null;
}

const textOf = (fragment: string) => fragment.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function taglineOf(html: string, title: string): string | null {
  const h1 = textOf(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '');
  if (h1 && h1.length <= TAGLINE_MAX) {
    return h1;
  }
  return title.split(TITLE_SEPARATOR)[1]?.trim() || null;
}

function logosOf(html: string, base: string, metadata: ReturnType<typeof parseHTMLMetadata>): SiteLogo[] {
  const found = [
    ...metadata.logos.filter((l) => l.type !== 'og-image').map((l) => ({ url: l.url, source: l.type })),
    { url: metadata.faviconUrl, source: 'favicon' },
    { url: linkHref(html, 'apple-touch-icon(?:-precomposed)?', base), source: 'apple-touch-icon' },
    { url: metadata.ogImage ? new URL(metadata.ogImage, base).href : null, source: 'og-image' }
  ];
  const seen = new Set<string>();
  return found
    .filter((l): l is { url: string; source: string } => Boolean(l.url) && !seen.has(l.url as string) && Boolean(seen.add(l.url as string)))
    .map((l) => ({ ...l, kind: SVG_URL.test(l.url) ? LogoKind.Svg : LogoKind.Raster }));
}

const LOGO_COLOURS: Record<LogoKind, (url: string) => Promise<string[]>> = {
  [LogoKind.Svg]: async (url) => hexesIn((await safeFetchUrl(url, { maxBytes: LOGO_SVG_MAX_BYTES, timeoutMs: IMAGE_TIMEOUT_MS })).body),
  [LogoKind.Raster]: (url) => extractColorsFromImage(url)
};

async function logoColours(logo: SiteLogo | undefined): Promise<string[]> {
  return logo ? LOGO_COLOURS[logo.kind](logo.url).catch(() => []) : [];
}

function fontsOf(metadata: ReturnType<typeof parseHTMLMetadata>): SiteFont[] {
  return metadata.fonts.map((f) => {
    const google = GOOGLE_FAMILIES.get(f.name.toLowerCase());
    return google ? { family: google, google: true } : { family: f.name, google: false };
  });
}

async function probe(url: string, role: ImageRole): Promise<SiteImage | null> {
  const fetched = await safeFetchBytes(url, { maxBytes: IMAGE_MAX_BYTES, timeoutMs: IMAGE_TIMEOUT_MS }).catch(() => null);
  if (!fetched?.ok || !fetched.mime.startsWith('image/')) {
    return null;
  }
  const { width, height } = await probeImageDimensions(fetched.bytes);
  if (!width || !height || Math.min(width, height) < MIN_IMAGE_EDGE) {
    return null;
  }
  return { url, width, height, role };
}

async function imagesOf(candidates: { url: string; role: ImageRole }[]): Promise<SiteImage[]> {
  const probed = await Promise.all(candidates.slice(0, IMAGES_PROBED).map((c) => probe(c.url, c.role)));
  return probed.filter((i): i is SiteImage => i !== null).slice(0, IMAGES_KEPT);
}

type StoreProduct = { name: string; pricing?: string; images?: string[]; url?: string };

async function productsOf(html: string, base: string): Promise<StoreProduct[]> {
  const products = isShopifySite(html) ? fetchShopifyProducts(base) : isWooCommerceSite(html) ? fetchWooCommerceProducts(base) : Promise.resolve([]);
  return (await products.catch(() => [])).slice(0, PRODUCTS_MAX);
}

async function read(input: string): Promise<SiteRead> {
  const page = await safeFetchUrl(input, { maxBytes: PAGE_MAX_BYTES, timeoutMs: PAGE_TIMEOUT_MS });
  if (!page.ok) {
    return { ok: false, error: `the site answered ${page.status}` };
  }
  const type = (page.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (type && !HTML_TYPES.includes(type)) {
    return { ok: false, error: `not a web page (${type})` };
  }

  const html = page.body;
  const base = page.url;
  const metadata = parseHTMLMetadata(html, base);
  const logos = logosOf(html, base, metadata);
  const logoLike = new Set(logos.map((l) => l.url));
  const ogImage = logos.find((l) => l.source === 'og-image')?.url;

  const [products, fromLogo] = await Promise.all([productsOf(html, base), logoColours(logos.find((l) => l.source !== 'og-image'))]);
  const candidates = [
    ...(ogImage ? [{ url: ogImage, role: ImageRole.Og }] : []),
    ...harvestPageImages(html, base).filter((url) => !logoLike.has(url)).map((url) => ({ url, role: ImageRole.Hero })),
    ...products.flatMap((p) => (p.images?.[0] ? [{ url: p.images[0], role: ImageRole.Product }] : []))
  ];
  const images = await imagesOf(candidates);

  const cssVars = Object.values(metadata.cssCustomProperties).flatMap(hexesIn);
  const palette = [...new Set([...(metadata.themeColor ? hexesIn(metadata.themeColor) : []), ...fromLogo.map((c) => c.toUpperCase()), ...cssVars, ...metadata.cssColors])].slice(0, PALETTE_MAX);

  return {
    ok: true,
    site: {
      url: base,
      name: metaContent(html, 'og:site_name') ?? metadata.title.split(TITLE_SEPARATOR)[0]?.trim() ?? new URL(base).hostname,
      tagline: taglineOf(html, metadata.title),
      description: metadata.ogDescription || metadata.description || null,
      logos,
      palette,
      fonts: fontsOf(metadata),
      images,
      products: products.map((p) => ({ name: p.name, price: p.pricing ?? null, url: p.url ?? null, image: p.images?.[0] ?? null })),
      socials: extractSocialHandles(html).map((s) => ({ platform: s.platform, url: s.url }))
    }
  };
}

export async function readSite(url: string): Promise<SiteRead> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<SiteRead>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, error: 'the site took too long to read' }), SITE_DEADLINE_MS);
  });
  try {
    return await Promise.race([read(url).catch((e: unknown): SiteRead => ({ ok: false, error: `could not read ${url}: ${errorOf(e)}` })), deadline]);
  } finally {
    clearTimeout(timer);
  }
}
