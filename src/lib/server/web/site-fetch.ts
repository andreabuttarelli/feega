import { assertPublicUrl, safeFetchUrl } from '$lib/server/tool-guard';
import type { OpenBrowser, RenderedLook, Tab } from './browser';
import type { PageRead } from './read-page';
import { exaPage, type SearchPort } from './search';

export enum SiteSource {
  Fetch = 'fetch',
  Browser = 'browser',
  Exa = 'exa',
  Secondary = 'secondary'
}

export type SiteOrigin = { url: string; html: string };
export type SitePageGot = { ok: true; url: string; html: string; headers?: Headers; sources?: SiteOrigin[]; costUsd?: number };
export type SiteGot = SitePageGot | { ok: false; error: string; costUsd?: number };
export type SiteStrategy = { source: SiteSource; timeoutMs: number; get: (url: string) => Promise<SiteGot> };
export type SiteTry = { source: SiteSource; ok: boolean; error: string | null; ms: number };
export type SiteFetch = (SitePageGot & { source: SiteSource; costUsd: number; tried: SiteTry[] }) | { ok: false; error: string; costUsd: number; tried: SiteTry[] };

export const ROBOTS_AGENT = 'feega';
export const SITE_PAGE_MAX_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 10_000;
const ROBOTS_TIMEOUT_MS = 3_000;
const ROBOTS_MAX_BYTES = 200_000;
const RENDER_TIMEOUT_MS = 35_000;
const EXA_TIMEOUT_MS = 20_000;
const SECONDARY_TIMEOUT_MS = 25_000;
const CHALLENGE_WAIT_MS = 8_000;
const CHALLENGE_POLL_MS = 1_000;
const THIN_TEXT_CHARS = 200;
const SECONDARY_RESULTS = 6;
const SECONDARY_READS = 3;
const HTML_TYPES = ['text/html', 'application/xhtml+xml'];
const HTML_HEADERS = () => new Headers({ 'content-type': 'text/html' });
const HTTP_ERROR = 400;

const BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const BROWSER_HEADERS: Record<string, string> = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'sec-ch-ua': '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1'
};

const CHALLENGES: [string, RegExp][] = [
  ['Cloudflare', /<title>\s*(just a moment|attention required)|_cf_chl_opt|cf-browser-verification/i],
  ['Vercel', /<title>\s*vercel security checkpoint/i],
  ['DataDome', /captcha-delivery\.com/i],
  ['PerimeterX', /px-captcha|_pxCaptcha/i],
  ['Akamai', /<title>\s*access denied\s*<\/title>[\s\S]{0,2000}reference\s*#/i]
];

enum Verdict {
  Page = 'page',
  Thin = 'thin',
  Blocked = 'blocked'
}

const errorOf = (e: unknown) => (e instanceof Error ? e.message : String(e));
const failed = (e: unknown): SiteGot => ({ ok: false, error: errorOf(e) });
const withScheme = (url: string) => (/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`);
const visibleText = (html: string) => html.replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function verdictOf(got: SitePageGot): { verdict: Verdict; why: string | null } {
  const wall = CHALLENGES.find(([, marker]) => marker.test(got.html));
  if (wall) {
    return { verdict: Verdict.Blocked, why: `a bot check answered (${wall[0]})` };
  }
  const text = visibleText([got.html, ...(got.sources ?? []).map((s) => s.html)].join(' '));
  return text.length < THIN_TEXT_CHARS ? { verdict: Verdict.Thin, why: 'the page has almost no text (an app shell?)' } : { verdict: Verdict.Page, why: null };
}

function within<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${Math.round(ms / 1000)}s`)), ms);
  });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

export async function fetchSite(url: string, chain: SiteStrategy[]): Promise<SiteFetch> {
  const tried: SiteTry[] = [];
  let costUsd = 0;
  let fallback: (SitePageGot & { source: SiteSource }) | null = null;

  for (const strategy of chain) {
    const started = Date.now();
    const got = await within(strategy.get(url), strategy.timeoutMs).catch(failed);
    costUsd += got.costUsd ?? 0;
    const ms = Date.now() - started;

    if (!got.ok) {
      tried.push({ source: strategy.source, ok: false, error: got.error, ms });
      continue;
    }

    const { verdict, why } = verdictOf(got);
    tried.push({ source: strategy.source, ok: verdict === Verdict.Page, error: why, ms });
    if (verdict === Verdict.Page) {
      return { ...got, source: strategy.source, costUsd, tried };
    }
    if (verdict === Verdict.Thin) {
      fallback ??= { ...got, source: strategy.source };
    }
  }

  if (fallback) {
    return { ...fallback, costUsd, tried };
  }
  return { ok: false, error: tried.map((t) => `${t.source}: ${t.error}`).join('; ') || 'no way to read it', costUsd, tried };
}

function robotsBan(robots: string, path: string): boolean {
  let agents: string[] = [];
  let inRules = false;
  const banned: string[] = [];

  for (const raw of robots.split('\n')) {
    const [field, ...rest] = raw.replace(/#.*/, '').split(':');
    const key = field.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (key === 'user-agent') {
      agents = inRules ? [value.toLowerCase()] : [...agents, value.toLowerCase()];
      inRules = false;
      continue;
    }
    if (key !== 'disallow' && key !== 'allow') {
      continue;
    }
    inRules = true;
    if (key === 'disallow' && value && agents.some((a) => a.includes(ROBOTS_AGENT))) {
      banned.push(value);
    }
  }
  return banned.some((rule) => path.startsWith(rule));
}

async function robotsAllow(url: string): Promise<boolean> {
  const page = new URL(url);
  const robots = await safeFetchUrl(new URL('/robots.txt', page).href, { maxBytes: ROBOTS_MAX_BYTES, timeoutMs: ROBOTS_TIMEOUT_MS }).catch(() => null);
  return !robots?.ok || !robotsBan(robots.body, page.pathname);
}

export function directFetch(): SiteStrategy {
  return {
    source: SiteSource.Fetch,
    timeoutMs: FETCH_TIMEOUT_MS + ROBOTS_TIMEOUT_MS,
    get: async (input) => {
      try {
        const url = withScheme(input);
        await assertPublicUrl(new URL(url));
        if (!(await robotsAllow(url))) {
          return { ok: false, error: `robots.txt disallows ${ROBOTS_AGENT} here` };
        }
        const page = await safeFetchUrl(url, { maxBytes: SITE_PAGE_MAX_BYTES, timeoutMs: FETCH_TIMEOUT_MS, userAgent: BROWSER_USER_AGENT, headers: BROWSER_HEADERS });
        if (!page.ok) {
          return { ok: false, error: `the site answered ${page.status}` };
        }
        const type = (page.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
        if (type && !HTML_TYPES.includes(type)) {
          return { ok: false, error: `not a web page (${type})` };
        }
        return { ok: true, url: page.url, html: page.body, headers: page.headers };
      } catch (e) {
        return failed(e);
      }
    }
  };
}

function lookCss(look: RenderedLook | null): string {
  if (!look) {
    return '';
  }
  const rules = [
    look.background || look.text ? `:root{${look.background ? `--rendered-background:${look.background};` : ''}${look.text ? `--rendered-text:${look.text};` : ''}}` : '',
    look.button ? `.rendered-button{background:${look.button}}` : '',
    look.body ? `body{font-family:${look.body}}` : '',
    look.heading ? `h1{font-family:${look.heading}}` : ''
  ].join('');
  return rules ? `<style id="rendered-look">${rules}</style>` : '';
}

const withLook = (html: string, look: RenderedLook | null) => (/<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${lookCss(look)}</head>`) : `${lookCss(look)}${html}`);

async function settled(tab: Tab, url: string): Promise<string> {
  const deadline = Date.now() + CHALLENGE_WAIT_MS;
  let html = await tab.html();
  while (CHALLENGES.some(([, m]) => m.test(html)) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, CHALLENGE_POLL_MS));
    html = await tab.html().catch(() => html);
  }
  return html || url;
}

async function rendered(tab: Tab, url: string): Promise<SiteGot> {
  const status = await tab.goto(url);
  const html = await settled(tab, url);
  const page = { ok: true as const, url: tab.url(), html, headers: HTML_HEADERS() };
  if (status !== null && status >= HTTP_ERROR && verdictOf(page).verdict !== Verdict.Page) {
    return { ok: false, error: `the site answered ${status}` };
  }
  return { ...page, html: withLook(html, await tab.look().catch(() => null)) };
}

export function renderedSite(open: OpenBrowser): SiteStrategy {
  return {
    source: SiteSource.Browser,
    timeoutMs: RENDER_TIMEOUT_MS,
    get: async (input) => {
      try {
        const url = withScheme(input);
        await assertPublicUrl(new URL(url));
        const tab = await open();
        const got = await rendered(tab, url).catch(failed);
        return { ...got, costUsd: await tab.close() };
      } catch (e) {
        return failed(e);
      }
    }
  };
}

const escaped = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plainMarkdown = (line: string) => line.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/(\*\*|__)/g, '').trim();

const MARKDOWN_BLOCKS: [RegExp, string][] = [
  [/^#\s+/, 'h1'],
  [/^#{2,6}\s+/, 'h2'],
  [/^[-*+]\s+/, 'li']
];

function markdownHtml(markdown: string): string {
  return markdown
    .split('\n')
    .map((line) => {
      const block = MARKDOWN_BLOCKS.find(([marker]) => marker.test(line.trim()));
      const text = plainMarkdown(block ? line.trim().replace(block[0], '') : line);
      const tag = block?.[1] ?? 'p';
      return text ? `<${tag}>${escaped(text)}</${tag}>` : '';
    })
    .join('');
}

function textPage(page: { title: string; markdown: string; image?: string | null; favicon?: string | null }): string {
  const head = [
    `<title>${escaped(page.title)}</title>`,
    page.image ? `<meta property="og:image" content="${escaped(page.image)}">` : '',
    page.favicon ? `<link rel="icon" href="${escaped(page.favicon)}">` : ''
  ].join('');
  return `<html><head>${head}</head><body>${markdownHtml(page.markdown)}</body></html>`;
}

export function exaContents(apiKey: string, http: typeof fetch = fetch): SiteStrategy {
  return {
    source: SiteSource.Exa,
    timeoutMs: EXA_TIMEOUT_MS,
    get: async (input) => {
      try {
        const url = withScheme(input);
        await assertPublicUrl(new URL(url));
        const page = await exaPage(apiKey, url, http);
        if (!page.ok) {
          return page;
        }
        return { ok: true, url: page.url, html: textPage({ title: page.title, markdown: page.text, image: page.image, favicon: page.favicon }), headers: HTML_HEADERS(), costUsd: page.costUsd };
      } catch (e) {
        return failed(e);
      }
    }
  };
}

const hostOf = (url: string) => new URL(withScheme(url)).hostname.replace(/^www\./, '');
const onHost = (url: string, host: string) => URL.canParse(url) && (hostOf(url) === host || hostOf(url).endsWith(`.${host}`));

export function secondarySources(search: SearchPort, read: (url: string) => Promise<PageRead>): SiteStrategy {
  return {
    source: SiteSource.Secondary,
    timeoutMs: SECONDARY_TIMEOUT_MS,
    get: async (input) => {
      const host = hostOf(input);
      const found = await search(host, SECONDARY_RESULTS);
      if (!found.ok) {
        return found;
      }
      const others = found.results.filter((r) => !onHost(r.url, host)).slice(0, SECONDARY_READS);
      if (!others.length) {
        return { ok: false, error: 'no other source writes about it', costUsd: found.costUsd };
      }
      const sources = await Promise.all(
        others.map(async (r) => {
          const page = await read(r.url).catch(() => null);
          return { url: r.url, html: textPage(page?.ok ? { title: page.title || r.title, markdown: page.markdown } : { title: r.title, markdown: r.snippet }) };
        })
      );
      return { ok: true, url: withScheme(input), html: '', headers: HTML_HEADERS(), sources, costUsd: found.costUsd };
    }
  };
}
