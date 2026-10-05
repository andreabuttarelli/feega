import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }));
vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('node:dns/promises', () => ({ lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]) }));

import sharp from 'sharp';
import type { Db } from '$lib/server/db/client';
import { importImageAsset, IMPORT_MAX_BYTES } from './asset-import';

const SCOPE = { orgId: 'org1', projectId: 'proj1', canvasId: 'canvas1' };

function serves(type: string, body: Buffer | string, length?: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      const headers = new Headers({ 'content-type': type });
      if (length) {
        headers.set('content-length', length);
      }
      return new Response(typeof body === 'string' ? body : new Uint8Array(body), { status: 200, headers });
    })
  );
}

function fakeDb() {
  const uploads: { bucket: string; path: string; type: string }[] = [];
  const rows: Record<string, unknown>[] = [];
  const db = {
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, file: File) => {
          uploads.push({ bucket, path, type: file.type });
          return { error: null };
        },
        createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://signed/${path}` }, error: null })
      })
    },
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        rows.push(row);
        return { select: () => ({ single: async () => ({ data: { id: 'asset1', project_id: row.project_id, type: row.type, url: row.url, content: null, mime_type: row.mime_type, bytes: row.bytes, width: row.width, height: row.height, duration_s: null, source: row.source, source_node_id: null, uncensored: false, created_at: '2026-10-05T00:00:00Z' }, error: null }) }) };
      }
    })
  };
  return { db: db as unknown as Db, uploads, rows };
}

describe('importImageAsset: a picture from the web becomes a project asset', () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it('stores a PNG under the org/project prefix of canvas-assets and returns the asset with its size', async () => {
    serves('image/png', await sharp({ create: { width: 640, height: 480, channels: 3, background: '#000' } }).png().toBuffer());
    const { db, uploads, rows } = fakeDb();

    const out = await importImageAsset(db, SCOPE, 'https://brand.example/hero.png');

    expect(out).toMatchObject({ ok: true, width: 640, height: 480, asset: { id: 'asset1', kind: 'image', url: expect.stringContaining('https://signed/org1/proj1/') } });
    expect(uploads[0]).toMatchObject({ bucket: 'canvas-assets', type: 'image/png' });
    expect(uploads[0].path).toMatch(/^org1\/proj1\/imports\/.+\.png$/);
    expect(rows[0]).toMatchObject({ org_id: 'org1', project_id: 'proj1', type: 'image', source: 'imported', url: uploads[0].path });
  });

  it('keeps an SVG logo as SVG, even when the server calls it text/plain', async () => {
    serves('text/plain', '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100"/></svg>');
    const { db, uploads } = fakeDb();

    const out = await importImageAsset(db, SCOPE, 'https://brand.example/logo.svg');

    expect(out.ok).toBe(true);
    expect(uploads[0]).toMatchObject({ type: 'image/svg+xml' });
    expect(uploads[0].path).toMatch(/\.svg$/);
  });

  it('refuses what is not a picture, whatever the header says', async () => {
    serves('image/png', '<html>not a picture</html>');
    const { db, uploads } = fakeDb();

    expect(await importImageAsset(db, SCOPE, 'https://brand.example/fake.png')).toMatchObject({ ok: false, error: expect.stringContaining('not an image') });
    expect(uploads).toEqual([]);
  });

  it('refuses a file over the ceiling before storing anything', async () => {
    serves('image/png', 'x', String(IMPORT_MAX_BYTES + 1));
    const { db, uploads } = fakeDb();

    expect(await importImageAsset(db, SCOPE, 'https://brand.example/huge.png')).toMatchObject({ ok: false });
    expect(uploads).toEqual([]);
  });

  it('refuses plain http', async () => {
    const { db } = fakeDb();

    expect(await importImageAsset(db, SCOPE, 'http://brand.example/logo.png')).toMatchObject({ ok: false });
  });
});
