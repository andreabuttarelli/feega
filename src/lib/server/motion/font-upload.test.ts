import { describe, expect, it, vi } from 'vitest';

const insertAsset = vi.fn(async (_db: unknown, input: Record<string, unknown>) => ({ id: 'asset-1', ...input }));
vi.mock('$lib/server/repos/assets', () => ({ insertAsset: (...a: [unknown, Record<string, unknown>]) => insertAsset(...a) }));

import { FontFormat, fontFormatOf, saveFontUpload } from './font-upload';
import type { Db } from '$lib/server/db/client';

function fakeDb(bytes: Uint8Array | null) {
  const remove = vi.fn(async () => ({ error: null }));
  const db = {
    storage: {
      from: () => ({
        download: async () => (bytes ? { data: new Blob([bytes as BlobPart]), error: null } : { data: null, error: { message: 'missing' } }),
        remove
      })
    }
  } as unknown as Db;
  return { db, remove };
}

const WOFF2 = new Uint8Array([0x77, 0x4f, 0x46, 0x32, 1, 2, 3]);
const scope = { orgId: 'org', projectId: 'p1' };

describe('font uploads', () => {
  it('recognises font files by their bytes, not their name', () => {
    expect(fontFormatOf(WOFF2)).toBe(FontFormat.Woff2);
    expect(fontFormatOf(new Uint8Array([0x4f, 0x54, 0x54, 0x4f]))).toBe(FontFormat.Otf);
    expect(fontFormatOf(new Uint8Array([0, 1, 0, 0]))).toBe(FontFormat.Ttf);
    expect(fontFormatOf(new TextEncoder().encode('<svg>'))).toBeNull();
  });

  it('registers a real font in the org folder as a font asset', async () => {
    const { db } = fakeDb(WOFF2);
    const saved = await saveFontUpload(db, { ...scope, path: 'org/p1/acme.woff2' });

    expect(saved).toEqual({ ok: true, assetId: 'asset-1', format: FontFormat.Woff2 });
    expect(insertAsset).toHaveBeenCalledWith(db, expect.objectContaining({ type: 'document', mimeType: 'font/woff2', url: 'org/p1/acme.woff2', bytes: WOFF2.length }));
  });

  it('refuses a path outside the org folder and deletes a file that is not a font', async () => {
    const { db, remove } = fakeDb(new TextEncoder().encode('<script>'));

    expect(await saveFontUpload(db, { ...scope, path: 'other/p1/x.woff2' })).toEqual({ ok: false, error: 'invalid_path' });
    expect(await saveFontUpload(db, { ...scope, path: 'org/p1/x.woff2' })).toMatchObject({ ok: false, error: expect.stringContaining('not a font') });
    expect(remove).toHaveBeenCalledWith(['org/p1/x.woff2']);
  });
});
