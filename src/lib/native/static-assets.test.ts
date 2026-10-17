import { describe, expect, it } from 'vitest';
import { hostedAssets } from './static-assets';

const HOSTED = 'https://oh.feega.app';

describe('static files the bundle leaves on the hosted app', () => {
  it('a preview path from the API points at the hosted app', () => {
    expect(hostedAssets({ posters: [{ preview: { poster: '/component-previews/a.jpg' } }] }, HOSTED)).toEqual({ posters: [{ preview: { poster: `${HOSTED}/component-previews/a.jpg` } }] });
  });

  it('bundled files, routes and absolute URLs stay as they are', () => {
    expect(hostedAssets(['/fonts/dm-sans-latin.woff2', '/p/p1/c/c1', 'https://x.supabase.co/a.jpg', '/app'], HOSTED)).toEqual(['/fonts/dm-sans-latin.woff2', '/p/p1/c/c1', 'https://x.supabase.co/a.jpg', '/app']);
  });
});
