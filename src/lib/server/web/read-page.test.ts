import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }));
vi.mock('$env/dynamic/private', () => ({ env: {} }));

import { MARKDOWN_MAX_CHARS, readPage } from './read-page';

const ARTICLE = readFileSync(new URL('./fixtures/article.html', import.meta.url), 'utf8');

const page = (body: string, type = 'text/html; charset=utf-8', status = 200) =>
  vi.fn(async (url: string) => ({ url, status, ok: status < 400, headers: new Headers({ 'content-type': type }), body }));

describe('read_page conversion', () => {
  it('keeps the main content as markdown, without scripts, styles, nav or footer', async () => {
    const out = await readPage('https://verde.example/news', page(ARTICLE));

    expect(out.ok).toBe(true);
    const read = out as Extract<typeof out, { ok: true }>;
    expect(read.title).toBe('Verde launches Flow | Verde');
    expect(read.markdown).toContain('# Flow is here');
    expect(read.markdown).toContain('**briefs**');
    expect(read.markdown).toMatch(/^-\s+Fast/m);
    expect(read.markdown).not.toMatch(/track|#123456|Legal|Pricing/);
    expect(read.truncated).toBe(false);
  });

  it('lists the page images as absolute urls, og:image first, data uris dropped', async () => {
    const out = (await readPage('https://verde.example/news', page(ARTICLE))) as { images: { url: string; alt: string }[] };

    expect(out.images).toEqual([
      { url: 'https://verde.example/og.png', alt: 'og:image' },
      { url: 'https://verde.example/img/hero.jpg', alt: 'Flow editor' },
      { url: 'https://cdn.verde.example/shot.webp', alt: '' }
    ]);
  });

  it('lists the links as absolute http urls with their text, anchors and mailto dropped', async () => {
    const out = (await readPage('https://verde.example/news', page(ARTICLE))) as { links: { url: string; text: string }[] };

    expect(out.links).toContainEqual({ url: 'https://verde.example/docs/flow', text: 'minutes' });
    expect(out.links).toContainEqual({ url: 'https://verde.example/pricing', text: 'Pricing' });
    expect(out.links.some((l) => /mailto|#top/.test(l.url))).toBe(false);
  });

  it('caps a long page and says so', async () => {
    const long = `<main><p>${'word '.repeat(MARKDOWN_MAX_CHARS)}</p></main>`;
    const out = (await readPage('https://verde.example/', page(long))) as { markdown: string; truncated: boolean };

    expect(out.truncated).toBe(true);
    expect(out.markdown.length).toBeLessThanOrEqual(MARKDOWN_MAX_CHARS);
  });

  it('passes plain text through and refuses what is not a page', async () => {
    expect(await readPage('https://verde.example/a.txt', page('hello', 'text/plain'))).toMatchObject({ ok: true, markdown: 'hello' });
    expect(await readPage('https://verde.example/a.zip', page('PK', 'application/zip'))).toEqual({ ok: false, error: 'not a web page (application/zip)' });
    expect(await readPage('https://verde.example/gone', page('', 'text/html', 404))).toEqual({ ok: false, error: 'the site answered 404' });
  });

  it('reads a huge unclosed tag in linear time', async () => {
    const hostile = `<main>${'<a href="x" '.repeat(50_000)}`;
    const t0 = Date.now();
    await readPage('https://verde.example/', page(hostile));
    expect(Date.now() - t0).toBeLessThan(3000);
  });
});

describe('read_page SSRF guard', () => {
  it.each([
    'http://127.0.0.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.5/',
    'http://[::1]/',
    'http://localhost:5173/',
    'http://metadata.google.internal/',
    'file:///etc/passwd',
    'ftp://verde.example/'
  ])('refuses %s without fetching it', async (url) => {
    const out = await readPage(url);

    expect(out.ok).toBe(false);
  });
});
