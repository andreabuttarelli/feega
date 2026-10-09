import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }));
vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }));

import { readFileSync } from 'node:fs';
import { lookup } from 'node:dns/promises';
import { SiteSource, directFetch, exaContents, fetchSite, renderedSite, secondarySources, type SiteStrategy } from './site-fetch';
import type { OpenBrowser } from './browser';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const SITE = 'https://brand.example/';
const PAGE = '<html><head><title>Brand</title></head><body><h1>Shoes that walk lighter</h1><p>Wool sneakers made from natural materials, shipped worldwide, free returns for thirty days.</p><p>Designed in Milan by people who walk a lot and care about how things are made.</p></body></html>';

function resolvesTo(byHost: Record<string, string>) {
  vi.mocked(lookup).mockImplementation((async (host: string) => {
    const address = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ? host : byHost[host];
    if (!address) {
      throw Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' });
    }
    return [{ address, family: 4 }];
  }) as never);
}

const answering = (source: SiteSource, got: Awaited<ReturnType<SiteStrategy['get']>>, timeoutMs = 1_000): SiteStrategy => ({ source, timeoutMs, get: vi.fn(async () => got) });

describe('fetchSite: one chain of strategies, tried in order', () => {
  it('stops at the first strategy that returns a real page and records what it tried', async () => {
    const chain = [
      answering(SiteSource.Fetch, { ok: false, error: 'the site answered 403' }),
      answering(SiteSource.Browser, { ok: true, url: SITE, html: PAGE, costUsd: 0.002 }),
      answering(SiteSource.Exa, { ok: true, url: SITE, html: PAGE })
    ];

    const read = await fetchSite(SITE, chain);

    expect(read).toMatchObject({ ok: true, source: SiteSource.Browser, html: PAGE, costUsd: 0.002 });
    expect(read.tried.map((t) => [t.source, t.ok, t.error])).toEqual([
      [SiteSource.Fetch, false, 'the site answered 403'],
      [SiteSource.Browser, true, null]
    ]);
    expect(chain[2].get).not.toHaveBeenCalled();
  });

  it.each([
    ['a Cloudflare challenge', 'challenge-cloudflare.html'],
    ['a Vercel checkpoint', 'challenge-vercel.html']
  ])('treats %s answered with 200 as blocked and moves on', async (_, file) => {
    const chain = [answering(SiteSource.Fetch, { ok: true, url: SITE, html: fixture(file) }), answering(SiteSource.Exa, { ok: true, url: SITE, html: PAGE })];

    const read = await fetchSite(SITE, chain);

    expect(read).toMatchObject({ ok: true, source: SiteSource.Exa });
    expect(read.tried[0]).toMatchObject({ source: SiteSource.Fetch, ok: false, error: expect.stringContaining('bot check') });
  });

  it('keeps an empty JavaScript shell only when nothing better comes', async () => {
    const shell = '<html><head><title>App</title></head><body><div id="root"></div><script src="/app.js"></script></body></html>';
    const chain = [answering(SiteSource.Fetch, { ok: true, url: SITE, html: shell }), answering(SiteSource.Browser, { ok: false, error: 'no browser' })];

    expect(await fetchSite(SITE, chain)).toMatchObject({ ok: true, source: SiteSource.Fetch, html: shell });
  });

  it('gives a strategy that hangs its own timeout and goes on', async () => {
    const hangs: SiteStrategy = { source: SiteSource.Browser, timeoutMs: 20, get: () => new Promise(() => undefined) };

    const read = await fetchSite(SITE, [hangs, answering(SiteSource.Exa, { ok: true, url: SITE, html: PAGE })]);

    expect(read).toMatchObject({ ok: true, source: SiteSource.Exa });
    expect(read.tried[0]).toMatchObject({ source: SiteSource.Browser, ok: false, error: expect.stringContaining('timed out') });
  });

  it('fails with every reason when no strategy reads the site, and adds up what they cost', async () => {
    const read = await fetchSite(SITE, [answering(SiteSource.Fetch, { ok: false, error: 'the site answered 503' }), answering(SiteSource.Browser, { ok: false, error: 'boom', costUsd: 0.002 })]);

    expect(read).toMatchObject({ ok: false, costUsd: 0.002, error: expect.stringContaining('fetch: the site answered 503') });
    expect(read.ok ? '' : read.error).toContain('browser: boom');
  });
});

describe('directFetch: a plain request dressed as a browser', () => {
  beforeEach(() => resolvesTo({ 'brand.example': '93.184.216.34' }));
  afterEach(() => vi.unstubAllGlobals());

  function serves(byUrl: Record<string, { status: number; body: string }>) {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | string, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
        const hit = byUrl[url];
        return hit ? new Response(hit.body, { status: hit.status, headers: { 'content-type': 'text/html' } }) : new Response('', { status: 404 });
      })
    );
    return calls;
  }

  it('sends the headers a browser sends', async () => {
    const calls = serves({ [SITE]: { status: 200, body: PAGE } });

    expect(await directFetch().get(SITE)).toMatchObject({ ok: true, html: PAGE });
    const page = calls.find((c) => c.url === SITE);
    expect(page?.headers['User-Agent']).toMatch(/Chrome\/\d+/);
    expect(page?.headers).toMatchObject({ 'Accept-Language': expect.any(String), 'sec-ch-ua': expect.any(String), Accept: expect.stringContaining('text/html') });
  });

  it('reports a 403 as a failure, not a page', async () => {
    serves({ [SITE]: { status: 403, body: 'Forbidden' } });

    expect(await directFetch().get(SITE)).toEqual({ ok: false, error: 'the site answered 403' });
  });

  it('respects a robots.txt that names feega', async () => {
    const calls = serves({ 'https://brand.example/robots.txt': { status: 200, body: 'User-agent: feega\nDisallow: /\n\nUser-agent: *\nAllow: /' }, [SITE]: { status: 200, body: PAGE } });

    expect(await directFetch().get(SITE)).toEqual({ ok: false, error: 'robots.txt disallows feega here' });
    expect(calls.map((c) => c.url)).not.toContain(SITE);
  });

  it('does not read a disallow for every robot as a ban on one page a person asked for', async () => {
    serves({ 'https://brand.example/robots.txt': { status: 200, body: 'User-agent: *\nDisallow: /' }, [SITE]: { status: 200, body: PAGE } });

    expect(await directFetch().get(SITE)).toMatchObject({ ok: true });
  });

  it('still refuses a host inside a private network', async () => {
    resolvesTo({ 'brand.example': '10.0.0.7' });
    const calls = serves({ [SITE]: { status: 200, body: PAGE } });

    expect(await directFetch().get(SITE)).toMatchObject({ ok: false });
    expect(calls).toEqual([]);
  });
});

describe('the other strategies keep the SSRF guard', () => {
  beforeEach(() => resolvesTo({ 'brand.example': '93.184.216.34', 'internal.example': '169.254.169.254' }));

  it('the browser never opens a private address', async () => {
    const open = vi.fn() as unknown as OpenBrowser;

    expect(await renderedSite(open).get('http://internal.example/')).toMatchObject({ ok: false });
    expect(open).not.toHaveBeenCalled();
  });

  it('Exa is never asked about a private address', async () => {
    const http = vi.fn() as unknown as typeof fetch;

    expect(await exaContents('key', http).get('http://internal.example/')).toMatchObject({ ok: false });
    expect(http).not.toHaveBeenCalled();
  });
});

describe('exaContents: the page as Exa crawled it', () => {
  beforeEach(() => resolvesTo({ 'brand.example': '93.184.216.34' }));

  it('turns Exa text into a page the brief can read, with its image and icon', async () => {
    const http = vi.fn(async () =>
      Response.json({ results: [{ url: SITE, title: 'Verde — Shoes', text: '# Shoes that walk lighter\n\nWool sneakers.\n\n- Free returns', image: 'https://brand.example/og.png', favicon: 'https://brand.example/icon.png' }], costDollars: { total: 0.001 } })
    ) as unknown as typeof fetch;

    const got = await exaContents('key', http).get(SITE);

    expect(got).toMatchObject({ ok: true, url: SITE, costUsd: 0.001 });
    const html = got.ok ? got.html : '';
    expect(html).toContain('<title>Verde — Shoes</title>');
    expect(html).toContain('<h1>Shoes that walk lighter</h1>');
    expect(html).toContain('<li>Free returns</li>');
    expect(html).toContain('property="og:image" content="https://brand.example/og.png"');
  });

  it('fails when Exa could not crawl the page', async () => {
    const http = vi.fn(async () => Response.json({ results: [], statuses: [{ id: SITE, status: 'error', error: { tag: 'CRAWL_NOT_FOUND' } }] })) as unknown as typeof fetch;

    expect(await exaContents('key', http).get(SITE)).toMatchObject({ ok: false, error: expect.stringContaining('CRAWL_NOT_FOUND') });
  });
});

describe('secondarySources: what others say, never passed off as the site', () => {
  it('reads other sources about the host and keeps their own urls', async () => {
    const search = vi.fn(async () => ({
      ok: true as const,
      costUsd: 0.005,
      results: [
        { title: 'Brand on the site', url: 'https://brand.example/about', snippet: 'self', date: null },
        { title: 'Brand raises', url: 'https://press.example/brand', snippet: 'Brand builds shoes.', date: null }
      ]
    }));
    const read = vi.fn(async (url: string) => ({ ok: true as const, url, title: 'Brand raises', markdown: '# Brand raises\n\nBrand builds wool shoes.', images: [], links: [], truncated: false }));

    const got = await secondarySources(search, read).get(SITE);

    expect(got).toMatchObject({ ok: true, costUsd: 0.005, sources: [{ url: 'https://press.example/brand' }] });
    expect(read).not.toHaveBeenCalledWith('https://brand.example/about');
  });
});
