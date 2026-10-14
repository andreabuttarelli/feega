import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cacheable } from './shell-cache';

const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

const manifest = JSON.parse(read('static/site.webmanifest'));
const appCss = read('src/app.css');
const appHtml = read('src/app.html');

function darkToken(name: string): string {
  const dark = appCss.slice(appCss.indexOf(':root[data-theme="dark"]'));
  const hit = dark.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'));
  return hit?.[1] ?? '';
}

const ORIGIN = 'https://oh.feega.app';
const SHELL = new Set(['/_app/immutable/entry/start.js', '/site.webmanifest']);
const at = (path: string, origin = ORIGIN) => new URL(path, origin);

describe('web app manifest', () => {
  it('is installable: name, standalone, root start and scope', () => {
    expect(manifest.name).toBe('feega');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.id).toBe('/');
  });

  it('has 192 and 512 icons, and a maskable one', () => {
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  });

  it('takes its colours from the dark design tokens', () => {
    expect(darkToken('grey-0')).not.toBe('');
    expect(manifest.background_color).toBe(darkToken('grey-0'));
    expect(manifest.theme_color).toBe(darkToken('grey-0'));
  });

  it('is linked from the page with iOS standalone metas', () => {
    expect(appHtml).toContain('rel="manifest" href="/site.webmanifest"');
    expect(appHtml).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(appHtml).toContain('name="apple-mobile-web-app-status-bar-style" content="default"');
    expect(appHtml).toContain('viewport-fit=cover');
  });
});

describe('service worker cache policy', () => {
  it('caches a shell asset', () => {
    expect(cacheable('GET', at('/_app/immutable/entry/start.js'), ORIGIN, SHELL)).toBe(true);
  });

  it('never caches the API, even a GET listed in the shell', () => {
    expect(cacheable('GET', at('/api/v1/brands'), ORIGIN, new Set(['/api/v1/brands']))).toBe(false);
  });

  it('never caches Supabase or any other origin', () => {
    const supabase = at('/_app/immutable/entry/start.js', 'https://klnswzhhgrqvbfjzioul.supabase.co');
    expect(cacheable('GET', supabase, ORIGIN, SHELL)).toBe(false);
  });

  it('never caches a page or a write', () => {
    expect(cacheable('GET', at('/p/x/c/y'), ORIGIN, SHELL)).toBe(false);
    expect(cacheable('POST', at('/site.webmanifest'), ORIGIN, SHELL)).toBe(false);
  });
});
