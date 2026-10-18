import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '$lib/server/db/client';

const safeFetchBytes = vi.fn();

vi.mock('$lib/server/tool-guard', async (importOriginal) => ({ ...(await importOriginal<object>()), safeFetchBytes: (...a: unknown[]) => safeFetchBytes(...a) }));

const { importCanvasLink, UploadError } = await import('./upload');

const scope = { orgId: 'org', projectId: 'project' };
const LINK = 'https://cdn.test/blue.png';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

function fakeDb() {
  const stored: { path: string; type: string }[] = [];
  const inserted: Record<string, unknown>[] = [];
  const storage = { upload: vi.fn(async (path: string, _bytes: unknown, opts: { contentType: string }) => (stored.push({ path, type: opts.contentType }), { error: null })) };
  const from = vi.fn(() => ({
    insert: (row: Record<string, unknown>) => {
      inserted.push(row);
      return { select: () => ({ single: async () => ({ data: { id: 'asset-1', type: row.type, url: row.url }, error: null }) }) };
    }
  }));
  return { stored, inserted, db: { storage: { from: () => storage }, from } as unknown as Db };
}

describe('copying a link into the project', () => {
  beforeEach(() => safeFetchBytes.mockReset());

  it('fetches the link, stores the file under the org folder and registers it as an asset', async () => {
    safeFetchBytes.mockResolvedValue({ url: LINK, status: 200, ok: true, mime: 'image/png', bytes: PNG });
    const { db, stored, inserted } = fakeDb();

    const { asset, kind } = await importCanvasLink(db, { ...scope, url: LINK });

    expect(safeFetchBytes).toHaveBeenCalledWith(LINK, expect.objectContaining({ scheme: 'https-only' }));
    expect(stored[0].path).toMatch(/^org\/project\/.+-blue\.png$/);
    expect(stored[0].type).toBe('image/png');
    expect(inserted[0]).toMatchObject({ org_id: 'org', project_id: 'project', type: 'image', url: stored[0].path });
    expect(asset.id).toBe('asset-1');
    expect(kind).toBe('image');
  });

  it('refuses a link that is not a picture or a video', async () => {
    safeFetchBytes.mockResolvedValue({ url: LINK, status: 200, ok: true, mime: 'text/html', bytes: Buffer.from('<html>') });
    const { db, stored } = fakeDb();

    await expect(importCanvasLink(db, { ...scope, url: LINK })).rejects.toBeInstanceOf(UploadError);
    expect(stored).toEqual([]);
  });

  it('refuses a link the server cannot fetch', async () => {
    safeFetchBytes.mockResolvedValue({ url: LINK, status: 404, ok: false, mime: 'text/html', bytes: Buffer.from('') });
    const { db } = fakeDb();

    await expect(importCanvasLink(db, { ...scope, url: LINK })).rejects.toBeInstanceOf(UploadError);
  });
});
