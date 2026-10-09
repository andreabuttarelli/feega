import { safeFetchUrl, type SafeFetchResult } from '$lib/server/tool-guard';

export const MARKDOWN_MAX_CHARS = 20_000;
const PAGE_MAX_BYTES = 2_000_000;
const PAGE_TIMEOUT_MS = 12_000;
const PAGE_MAX_REDIRECTS = 4;
const IMAGES_MAX = 20;
const LINKS_MAX = 40;
const LINK_TEXT_MAX = 120;
const ALT_MAX = 120;
const HTML_TYPES = ['text/html', 'application/xhtml+xml'];
const TEXT_TYPES = ['text/plain', 'text/markdown'];
const WEB_SCHEMES = ['http:', 'https:'];
const MAIN_TAGS = ['main', 'article'];
const CHROME = new Set(['script', 'style', 'noscript', 'svg', 'button', 'nav', 'header', 'footer', 'aside', 'form', 'iframe', 'template']);

export type PageImage = { url: string; alt: string };
export type PageLink = { url: string; text: string };
export type PageRead =
  | { ok: true; url: string; title: string; markdown: string; images: PageImage[]; links: PageLink[]; truncated: boolean }
  | { ok: false; error: string };
export type PageFetch = (url: string) => Promise<SafeFetchResult>;

const guarded: PageFetch = (url) => safeFetchUrl(url, { maxBytes: PAGE_MAX_BYTES, timeoutMs: PAGE_TIMEOUT_MS, maxRedirects: PAGE_MAX_REDIRECTS });

const errorOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

const plain = (fragment: string) => fragment.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

function* tags(html: string, lower: string, name: string): Generator<{ tag: string; end: number }> {
  const open = `<${name}`;
  let at = lower.indexOf(open);
  while (at !== -1) {
    const end = lower.indexOf('>', at);
    if (end === -1) {
      return;
    }
    const next = lower[at + open.length];
    if (/[\s/>]/.test(next)) {
      yield { tag: html.slice(at, end + 1), end: end + 1 };
    }
    at = lower.indexOf(open, end);
  }
}

function attr(tag: string, name: string): string | null {
  return tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'))?.slice(1).find((v) => v !== undefined) ?? null;
}

function absolute(href: string, base: string): string | null {
  try {
    const url = new URL(href.trim(), base);
    return WEB_SCHEMES.includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function titleOf(html: string, lower: string): string {
  const start = lower.indexOf('<title');
  const open = start === -1 ? -1 : lower.indexOf('>', start);
  const end = open === -1 ? -1 : lower.indexOf('</title', open);
  return end === -1 ? '' : plain(html.slice(open + 1, end));
}

function metaImage(html: string, lower: string): string | null {
  for (const { tag } of tags(html, lower, 'meta')) {
    if (/(?:property|name)\s*=\s*["']og:image["']/i.test(tag)) {
      return attr(tag, 'content');
    }
  }
  return null;
}

function imagesOf(html: string, lower: string, base: string): PageImage[] {
  const og = metaImage(html, lower);
  const found = [
    ...(og ? [{ src: og, alt: 'og:image' }] : []),
    ...[...tags(html, lower, 'img')].map(({ tag }) => ({ src: attr(tag, 'src') ?? attr(tag, 'data-src') ?? '', alt: (attr(tag, 'alt') ?? '').slice(0, ALT_MAX) }))
  ];
  const seen = new Set<string>();
  return found
    .flatMap(({ src, alt }) => {
      const url = absolute(src, base);
      return url && !seen.has(url) && seen.add(url) ? [{ url, alt }] : [];
    })
    .slice(0, IMAGES_MAX);
}

function linksOf(html: string, lower: string, base: string, self: string): PageLink[] {
  const seen = new Set<string>([self]);
  const links: PageLink[] = [];
  for (const { tag, end } of tags(html, lower, 'a')) {
    const url = absolute(attr(tag, 'href') ?? '', base)?.split('#')[0];
    if (!url || seen.has(url)) {
      continue;
    }
    seen.add(url);
    const close = lower.indexOf('</a', end);
    links.push({ url, text: plain(html.slice(end, close === -1 ? end : Math.min(close, end + LINK_TEXT_MAX * 4))).slice(0, LINK_TEXT_MAX) });
    if (links.length === LINKS_MAX) {
      break;
    }
  }
  return links;
}

function mainOf(html: string, lower: string): string {
  for (const name of MAIN_TAGS) {
    const start = lower.indexOf(`<${name}`);
    const end = lower.lastIndexOf(`</${name}>`);
    if (start !== -1 && end > start) {
      return html.slice(start, end);
    }
  }
  const body = lower.indexOf('<body');
  return body === -1 ? html : html.slice(body);
}

async function markdownOf(html: string): Promise<string> {
  const TurndownService = (await import('turndown')).default;
  // @ts-expect-error no types
  const { gfm } = await import('turndown-plugin-gfm');
  const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
  td.use(gfm);
  td.remove((node) => CHROME.has(node.nodeName.toLowerCase()));
  return td.turndown(html).replace(/\n{3,}/g, '\n\n').trim();
}

function capped(markdown: string): { markdown: string; truncated: boolean } {
  return markdown.length <= MARKDOWN_MAX_CHARS ? { markdown, truncated: false } : { markdown: markdown.slice(0, MARKDOWN_MAX_CHARS), truncated: true };
}

export async function readHtml(url: string, html: string): Promise<PageRead> {
  const lower = html.toLowerCase();
  return {
    ok: true,
    url,
    title: titleOf(html, lower),
    ...capped(await markdownOf(mainOf(html, lower))),
    images: imagesOf(html, lower, url),
    links: linksOf(html, lower, url, url.split('#')[0])
  };
}

export async function readPage(input: string, fetchPage: PageFetch = guarded): Promise<PageRead> {
  const scheme = input.trim().match(/^([a-z][a-z0-9+.-]*):(?!\d)/i)?.[1]?.toLowerCase();
  if (scheme && !WEB_SCHEMES.includes(`${scheme}:`)) {
    return { ok: false, error: 'only http and https pages can be read' };
  }
  try {
    const page = await fetchPage(input);
    if (!page.ok) {
      return { ok: false, error: `the site answered ${page.status}` };
    }
    const type = (page.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (TEXT_TYPES.includes(type)) {
      return { ok: true, url: page.url, title: '', ...capped(page.body), images: [], links: [] };
    }
    if (type && !HTML_TYPES.includes(type)) {
      return { ok: false, error: `not a web page (${type})` };
    }
    return await readHtml(page.url, page.body);
  } catch (e) {
    return { ok: false, error: `could not read ${input}: ${errorOf(e)}` };
  }
}
