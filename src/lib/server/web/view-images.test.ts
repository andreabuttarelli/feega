import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';

vi.mock('$env/static/public', () => ({ PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }));
vi.mock('$env/dynamic/private', () => ({ env: {} }));

import { SafeFetchError } from '$lib/server/tool-guard';
import { VIEW_MAX_EDGE, ViewDetail, viewImages, type ViewPorts } from './view-images';

const png = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: '#1a6b4f' } }).png().toBuffer();

function ports(over: Partial<ViewPorts> = {}) {
  const stored = new Map<string, Buffer>();
  const removed: string[] = [];
  const p: ViewPorts = {
    fetchImage: vi.fn(async (url: string) => ({ url, status: 200, ok: true, mime: 'image/png', bytes: await png(3000, 1500) })),
    store: vi.fn(async (path: string, bytes: Buffer) => {
      stored.set(path, bytes);
    }),
    screen: vi.fn(async () => ({ ok: true as const })),
    remove: vi.fn(async (path: string) => {
      removed.push(path);
    }),
    ...over
  };
  return { p, stored, removed };
}

describe('view_images', () => {
  it('fetches, shrinks, stores and returns each picture as an image for the model, with only paths in the record', async () => {
    const { p, stored } = ports();

    const out = await viewImages(['https://a.example/x.png'], ViewDetail.High, 'org/p/web-views/c1', p);

    expect(out.images).toEqual([{ url: 'https://a.example/x.png', path: 'org/p/web-views/c1/0.jpg', width: VIEW_MAX_EDGE, height: VIEW_MAX_EDGE / 2 }]);
    expect(out.parts).toHaveLength(1);
    expect(out.parts[0].mediaType).toBe('image/jpeg');
    expect((await sharp(stored.get('org/p/web-views/c1/0.jpg')!).metadata()).width).toBe(VIEW_MAX_EDGE);
    expect(JSON.stringify(out.images)).not.toMatch(/base64|data:/);
  });

  it('keeps the low detail smaller', async () => {
    const out = await viewImages(['https://a.example/x.png'], ViewDetail.Low, 'pre', ports().p);

    expect((out.images[0] as { width: number }).width).toBeLessThan(VIEW_MAX_EDGE);
  });

  it('refuses private addresses, non-images and pictures the safety review refuses, and keeps the others', async () => {
    const { p, removed } = ports({
      fetchImage: vi.fn(async (url: string) => {
        if (url.includes('169.254')) {
          throw new SafeFetchError('not_public', 'That host is not reachable');
        }
        if (url.endsWith('.html')) {
          return { url, status: 200, ok: true, mime: 'text/html', bytes: Buffer.from('<html>') };
        }
        return { url, status: 200, ok: true, mime: 'image/png', bytes: await png(100, 100) };
      }),
      screen: vi.fn(async (path: string) => (path.endsWith('/2.jpg') ? { ok: false as const, error: 'refused by the safety review' } : { ok: true as const }))
    });

    const out = await viewImages(['http://169.254.169.254/x.png', 'https://a.example/page.html', 'https://a.example/nsfw.png', 'https://a.example/ok.png'], ViewDetail.High, 'pre', p);

    expect(out.images).toEqual([
      { url: 'http://169.254.169.254/x.png', error: 'That host is not reachable' },
      { url: 'https://a.example/page.html', error: 'not a picture (text/html)' },
      { url: 'https://a.example/nsfw.png', error: 'refused by the safety review' },
      { url: 'https://a.example/ok.png', path: 'pre/3.jpg', width: 100, height: 100 }
    ]);
    expect(removed).toEqual(['pre/2.jpg']);
    expect(out.parts).toHaveLength(1);
  });
});
