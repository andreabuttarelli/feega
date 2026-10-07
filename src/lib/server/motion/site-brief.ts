import {
  extractColorsFromImage,
  extractFonts,
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
import { AccentSource, pickAccent, type Accent } from '$lib/motion/accent';

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
const STYLESHEETS_READ = 3;
const STYLESHEET_MAX_BYTES = 1_000_000;
const INLINE_LOGO_MAX = 100_000;
const INLINE_LOGO_CONTEXT = 300;
const INLINE_LOGO_ANCHOR = '#inline-logo';

export enum ImageRole {
  Og = 'og',
  Hero = 'hero',
  Product = 'product'
}

export enum LogoKind {
  Svg = 'svg',
  Raster = 'raster'
}

export type SiteLogo = { url: string; kind: LogoKind; source: string; markup?: string };
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
  accent: Accent;
  fonts: SiteFont[];
  images: SiteImage[];
  products: SiteProduct[];
  socials: { platform: string; url: string }[];
};
export type SiteRead = { ok: true; site: SiteBrief } | { ok: false; error: string };

const HEX = /#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi;
const SVG_URL = /\.svg(?:[?#]|$)/i;
const INLINE_SVG = /<svg\b[\s\S]*?<\/svg>/gi;
const LOGO_HINT = /logo|brand|wordmark/i;
const STYLESHEET = /<link[^>]+rel=["']stylesheet["'][^>]*>/gi;
const FAMILY_NAME = /^[\w][\w .-]*$/;
const SVG_NS ='http://www.w3.org/2000/svg';
const TITLE_SEPARATOR = /\s+[|–—:·-]\s+/;
const CSS_RULE = /([^{}]+)\{([^{}]*)\}/g;
const ACTION_SELECTOR = /button|btn|cta|primary|\ba\b|link/i;
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

const secured = (url: string, base: string) => (new URL(base).protocol === 'https:' ? url.replace(/^http:/i, 'https:') : url);

function inlineLogo(html: string): string | null {
  for (const m of html.matchAll(INLINE_SVG)) {
    const svg = m[0];
    const around = html.slice(Math.max(0, m.index - INLINE_LOGO_CONTEXT), m.index) + svg.slice(0, INLINE_LOGO_CONTEXT);
    if (svg.length <= INLINE_LOGO_MAX && /<path/i.test(svg) && LOGO_HINT.test(around)) {
      return svg.replace(/^<svg\b(?![^>]*\bxmlns=)/i, `<svg xmlns="${SVG_NS}"`);
    }
  }
  return null;
}

function logosOf(html: string, base: string, metadata: ReturnType<typeof parseHTMLMetadata>): SiteLogo[] {
  const inline = inlineLogo(html);
  const drawn: SiteLogo[] = inline ? [{ url: new URL(INLINE_LOGO_ANCHOR, base).href, kind: LogoKind.Svg, source: 'inline-svg', markup: inline }] : [];
  const found = [
    ...metadata.logos.filter((l) => l.type !== 'og-image').map((l) => ({ url: l.url, source: l.type })),
    { url: metadata.faviconUrl, source: 'favicon' },
    { url: linkHref(html, 'apple-touch-icon(?:-precomposed)?', base), source: 'apple-touch-icon' },
    { url: metadata.ogImage ? new URL(metadata.ogImage, base).href : null, source: 'og-image' }
  ];
  const seen = new Set<string>();
  const linked = found
    .map((l) => ({ ...l, url: l.url ? secured(l.url, base) : null }))
    .filter((l): l is { url: string; source: string } => Boolean(l.url) && !seen.has(l.url as string) && Boolean(seen.add(l.url as string)))
    .map((l) => ({ ...l, kind: SVG_URL.test(l.url) ? LogoKind.Svg : LogoKind.Raster }));
  return [...drawn, ...linked];
}

const LOGO_COLOURS: Record<LogoKind, (logo: SiteLogo) => Promise<string[]>> = {
  [LogoKind.Svg]: async (logo) => hexesIn(logo.markup ?? (await safeFetchUrl(logo.url, { maxBytes: LOGO_SVG_MAX_BYTES, timeoutMs: IMAGE_TIMEOUT_MS })).body),
  [LogoKind.Raster]: (logo) => extractColorsFromImage(logo.url)
};

async function logoColours(logo: SiteLogo | undefined): Promise<string[]> {
  return logo ? LOGO_COLOURS[logo.kind](logo).catch(() => []) : [];
}

function actionColours(css: string): string[] {
  return [...css.matchAll(CSS_RULE)].filter((m) => ACTION_SELECTOR.test(m[1])).flatMap((m) => hexesIn(m[2]));
}

async function linkedCss(html: string, base: string): Promise<string> {
  const hrefs = [...html.matchAll(STYLESHEET)].map((m) => m[0].match(/href=["']([^"']+)["']/i)?.[1]).filter((h): h is string => Boolean(h));
  const sheets = hrefs.slice(0, STYLESHEETS_READ).map((href) =>
    safeFetchUrl(new URL(href, base).href, { maxBytes: STYLESHEET_MAX_BYTES, timeoutMs: PAGE_TIMEOUT_MS })
      .then((r) => (r.ok ? r.body : ''))
      .catch(() => '')
  );
  return (await Promise.all(sheets)).join('\n');
}

function fontsOf(found: { name: string }[]): SiteFont[] {
  const fonts = found.filter((f) => FAMILY_NAME.test(f.name)).map((f) => {
    const google = GOOGLE_FAMILIES.get(f.name.toLowerCase());
    return google ? { family: google, google: true } : { family: f.name, google: false };
  });
  return fonts.filter((f, i) => fonts.findIndex((o) => o.family === f.family) === i);
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

  const [products, fromLogo, fromFavicon, css] = await Promise.all([
    productsOf(html, base),
    logoColours(logos.find((l) => l.source !== 'og-image')),
    logoColours(logos.find((l) => l.source === 'favicon' || l.source === 'apple-touch-icon')),
    linkedCss(html, base)
  ]);
  const candidates = [
    ...(ogImage ? [{ url: ogImage, role: ImageRole.Og }] : []),
    ...harvestPageImages(html, base).map((url) => secured(url, base)).filter((url) => !logoLike.has(url)).map((url) => ({ url, role: ImageRole.Hero })),
    ...products.flatMap((p) => (p.images?.[0] ? [{ url: p.images[0], role: ImageRole.Product }] : []))
  ];
  const images = await imagesOf(candidates);

  const cssVars = Object.values(metadata.cssCustomProperties).flatMap(hexesIn);
  const palette = [...new Set([...(metadata.themeColor ? hexesIn(metadata.themeColor) : []), ...fromLogo.map((c) => c.toUpperCase()), ...cssVars, ...metadata.cssColors])].slice(0, PALETTE_MAX);

  const theme = metadata.themeColor ? hexesIn(metadata.themeColor) : [];
  const accent = pickAccent({
    [AccentSource.Logo]: fromLogo.map((c) => c.toUpperCase()),
    [AccentSource.Favicon]: fromFavicon.map((c) => c.toUpperCase()),
    [AccentSource.Theme]: theme,
    [AccentSource.Buttons]: actionColours(`${html}\n${css}`),
    [AccentSource.Css]: [...cssVars, ...metadata.cssColors]
  });

  return {
    ok: true,
    site: {
      url: base,
      name: metaContent(html, 'og:site_name') ?? metadata.title.split(TITLE_SEPARATOR)[0]?.trim() ?? new URL(base).hostname,
      tagline: taglineOf(html, metadata.title),
      description: metadata.ogDescription || metadata.description || null,
      logos,
      palette,
      accent,
      fonts: fontsOf([...metadata.fonts, ...extractFonts(`<style>${css}</style>`)]),
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
