import type { PageFont } from './page-tree';

export type FetchText = (url: string) => Promise<string>;

const MAX_SHEETS = 12;
const FACE = /@font-face\s*{[^}]*}/g;
const SOURCE = /url\(["']?([^"')]+)["']?\)\s*(?:format\(["']?([\w-]+)["']?\))?/g;
const WOFF2 = /woff2/;
const WEB_FONT = /woff|truetype|opentype/;
const WOFF2_FILE = /\.woff2(\?|$)/;
const FONT_FILE = /\.(woff|ttf|otf)(\?|$)/;
const WEB = /^https?:/;

function sourceOf(src: string, href: string): string | null {
  const urls = [...src.matchAll(SOURCE)].flatMap((m) => (URL.canParse(m[1], href) ? [{ url: new URL(m[1], href).href, format: m[2] ?? '' }] : []));
  const pick = urls.find((u) => WOFF2.test(u.format) || WOFF2_FILE.test(u.url)) ?? urls.find((u) => WEB_FONT.test(u.format) || FONT_FILE.test(u.url));
  return pick && WEB.test(pick.url) ? pick.url : null;
}

export function fontFacesIn(css: string, href: string): PageFont[] {
  return (css.match(FACE) ?? []).flatMap((block) => {
    const get = (prop: string) => block.match(new RegExp(`${prop}\\s*:\\s*([^;}]+)`))?.[1]?.trim() ?? '';
    const url = sourceOf(get('src'), href);
    return url ? [{ family: get('font-family').replace(/["']/g, '').trim(), weight: get('font-weight') || '400', style: get('font-style') || 'normal', url }] : [];
  });
}

export async function sheetFonts(sheets: readonly string[], fetchText: FetchText): Promise<PageFont[]> {
  const read = await Promise.all(sheets.slice(0, MAX_SHEETS).map(async (href) => fontFacesIn(await fetchText(href).catch(() => ''), href)));
  return read.flat();
}
