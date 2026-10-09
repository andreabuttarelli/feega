import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('node:dns/promises', () => ({ lookup: vi.fn(async (host: string) => [{ address: /^[\d.]+$/.test(host) ? host : host === 'rebound.example' ? '10.0.0.5' : '93.184.216.34', family: 4 }]) }));

import { analyzeBrand } from './brand-analysis';

const client = { models: { generateContent: vi.fn(async () => ({ text: '{}' })) } };
const analyze = (url: string) => analyzeBrand({} as never, {}, client, [url]).catch(() => null);

describe('analyzeBrand site images', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(['http://169.254.169.254/latest/meta-data/', 'http://localhost/logo.png', 'https://rebound.example/hero.png'])('never downloads an internal address: %s', async (url) => {
    const fetcher = vi.fn(async () => new Response('secret', { headers: { 'content-type': 'image/png' } }));
    vi.stubGlobal('fetch', fetcher);

    await analyze(url);

    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not follow a redirect to a private address', async () => {
    const fetcher = vi.fn(async (input: URL | string) => (String(input).includes('brand.example') ? new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } }) : new Response('secret', { headers: { 'content-type': 'image/png' } })));
    vi.stubGlobal('fetch', fetcher);

    await analyze('https://brand.example/hero.png');

    expect(fetcher.mock.calls.map(([u]) => String(u))).toEqual(['https://brand.example/hero.png']);
  });
});
