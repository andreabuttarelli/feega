import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }));
vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }));

import sharp from 'sharp';
import { lookup } from 'node:dns/promises';
import { readSite, PAGE_MAX_BYTES } from './site-brief';

type Hop = { status?: number; location?: string; type?: string; length?: string; body?: string | Buffer };

const LITERAL_IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

function resolvesTo(byHost: Record<string, string>) {
  vi.mocked(lookup).mockImplementation((async (host: string) => {
    const address = LITERAL_IPV4.test(host) ? host : byHost[host];
    if (!address) {
      throw Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' });
    }
    return [{ address, family: 4 }];
  }) as never);
}

function serves(hops: Record<string, Hop>): string[] {
  const requested: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: URL | string) => {
      const url = String(input);
      requested.push(url);
      const hop = hops[url];
      if (!hop) {
        throw new Error(`ECONNREFUSED ${url}`);
      }
      const headers = new Headers();
      if (hop.location) {
        headers.set('location', hop.location);
      }
      if (hop.type) {
        headers.set('content-type', hop.type);
      }
      if (hop.length) {
        headers.set('content-length', hop.length);
      }
      const body = hop.body === undefined ? null : typeof hop.body === 'string' ? hop.body : new Uint8Array(hop.body);
      return new Response(body, { status: hop.status ?? 200, headers });
    })
  );
  return requested;
}

const png = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: '#1a6b4f' } }).png().toBuffer();

const SITE = 'https://brand.example/';

const HTML = `<!doctype html><html><head>
<title>Verde — Shoes that walk lighter</title>
<meta name="description" content="Wool sneakers made from natural materials.">
<meta property="og:site_name" content="Verde">
<meta property="og:image" content="http://brand.example/og.png">
<meta name="theme-color" content="#1A6B4F">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch.png">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter&display=swap" rel="stylesheet">
<style>:root { --brand: #F2C14E; } body { font-family: 'Made Up Sans', sans-serif; color: #222222 }</style>
</head><body>
<img class="site-logo" src="/logo.svg" alt="Verde">
<h1>Shoes that <em>walk</em> lighter</h1>
<img src="/hero.png" alt="">
<img src="/pixel.png" alt="">
<a href="https://www.instagram.com/verde">ig</a>
<a href="https://twitter.com/intent/tweet">share</a>
</body></html>`;

describe('readSite: what a trailer needs from a public page', () => {
  beforeEach(() => resolvesTo({ 'brand.example': '93.184.216.34' }));
  afterEach(() => vi.unstubAllGlobals());

  it('extracts name, tagline, description, logos with fallbacks, palette, Google fonts, sized images and socials', async () => {
    serves({
      [SITE]: { type: 'text/html; charset=utf-8', body: HTML },
      'https://brand.example/hero.png': { type: 'image/png', body: await png(1600, 900) },
      'https://brand.example/og.png': { type: 'image/png', body: await png(1200, 630) },
      'https://brand.example/pixel.png': { type: 'image/png', body: await png(1, 1) },
      'https://brand.example/logo.svg': { type: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#0B3D2E" d="M0 0h10v10z"/></svg>' }
    });

    const read = await readSite('brand.example');
    if (!read.ok) {
      throw new Error(read.error);
    }
    const site = read.site;

    expect(site.name).toBe('Verde');
    expect(site.tagline).toBe('Shoes that walk lighter');
    expect(site.description).toBe('Wool sneakers made from natural materials.');
    expect(site.logos.map((l) => [l.url, l.kind])).toEqual([
      ['https://brand.example/logo.svg', 'svg'],
      ['https://brand.example/favicon.png', 'raster'],
      ['https://brand.example/apple-touch.png', 'raster'],
      ['https://brand.example/og.png', 'raster']
    ]);
    expect(site.palette.slice(0, 3)).toEqual(['#1A6B4F', '#0B3D2E', '#F2C14E']);
    expect(site.fonts).toEqual([
      { family: 'Playfair Display', google: true },
      { family: 'Inter', google: true },
      { family: 'Made Up Sans', google: false }
    ]);
    expect(site.images).toEqual([
      { url: 'https://brand.example/og.png', width: 1200, height: 630, role: 'og' },
      { url: 'https://brand.example/hero.png', width: 1600, height: 900, role: 'hero' }
    ]);
    expect(site.socials).toEqual([{ platform: 'instagram', url: 'https://www.instagram.com/verde' }]);
  });

  it('refuses a host that resolves into a private network before any request', async () => {
    resolvesTo({ 'evil.example': '10.0.0.5' });
    const requested = serves({});

    const read = await readSite('https://evil.example/');

    expect(read.ok).toBe(false);
    expect(requested).toEqual([]);
  });

  it('refuses a redirect into the metadata service', async () => {
    const requested = serves({ [SITE]: { status: 302, location: 'http://169.254.169.254/latest/meta-data/' } });

    const read = await readSite(SITE);

    expect(read.ok).toBe(false);
    expect(requested).toEqual([SITE]);
  });

  it('refuses a page that declares more bytes than the ceiling', async () => {
    serves({ [SITE]: { type: 'text/html', length: String(PAGE_MAX_BYTES + 1), body: HTML } });

    expect(await readSite(SITE)).toMatchObject({ ok: false });
  });

  it('refuses what is not a web page', async () => {
    serves({ [SITE]: { type: 'application/pdf', body: '%PDF-1.7' } });

    expect(await readSite(SITE)).toMatchObject({ ok: false, error: expect.stringContaining('not a web page') });
  });

  it('finds a logo drawn inline in the header and fonts declared in a linked stylesheet', async () => {
    const page = `<html><head><title>Verde</title><link href="/theme.css" rel="stylesheet"></head><body><header><a href="/" aria-label="Verde"><svg viewBox="0 0 74 24" fill="none"><g id="logo"><path fill="#0B3D2E" d="M0 0h74v24H0z"/></g></svg></a></header></body></html>`;
    serves({
      [SITE]: { type: 'text/html', body: page },
      'https://brand.example/theme.css': { type: 'text/css', body: "@font-face { font-family: 'Geograph'; } h1 { font-family: 'Geograph', sans-serif } p { font-family: Lora, serif }" }
    });

    const read = await readSite(SITE);
    if (!read.ok) {
      throw new Error(read.error);
    }

    expect(read.site.logos[0]).toMatchObject({ url: 'https://brand.example/#inline-logo', kind: 'svg', source: 'inline-svg', markup: expect.stringMatching(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/) });
    expect(read.site.palette).toContain('#0B3D2E');
    expect(read.site.fonts).toEqual([
      { family: 'Geograph', google: false },
      { family: 'Lora', google: true }
    ]);
  });

  it('keeps the page when an image is too large to probe, dropping only that image', async () => {
    serves({
      [SITE]: { type: 'text/html', body: HTML },
      'https://brand.example/hero.png': { type: 'image/png', length: '999999999', body: 'x' },
      'https://brand.example/og.png': { type: 'image/png', body: await png(1200, 630) }
    });

    const read = await readSite(SITE);

    expect(read.ok && read.site.images.map((i) => i.url)).toEqual(['https://brand.example/og.png']);
  });
});
