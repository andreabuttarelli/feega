import { describe, expect, it, vi } from 'vitest';
import { cardPreviews, saveCardPreview } from './card-previews';

const SCOPE = { orgId: 'o', projectId: 'p' };
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

function fakeStorage(files: { name: string; updated_at: string }[]) {
  const bucket = {
    list: vi.fn(async () => ({ data: files, error: null })),
    upload: vi.fn(async () => ({ data: {}, error: null })),
    remove: vi.fn(async () => ({ data: [], error: null })),
    createSignedUrls: vi.fn(async (paths: string[]) => ({ data: paths.map((path) => ({ path, signedUrl: `https://signed/${path}`, error: null })), error: null }))
  };
  return { db: { storage: { from: () => bucket } } as never, bucket };
}

describe('card previews kept per node in storage', () => {
  it('answers the newest preview of every node with its key, in one listing and one signing', async () => {
    const { db, bucket } = fakeStorage([
      { name: `n1.${HASH_A}.webp`, updated_at: '2026-10-18T10:00:00Z' },
      { name: `n1.${HASH_B}.webp`, updated_at: '2026-10-18T11:00:00Z' },
      { name: `n2.${HASH_A}.webp`, updated_at: '2026-10-18T09:00:00Z' },
      { name: 'stray.txt', updated_at: '2026-10-18T09:00:00Z' }
    ]);

    const previews = await cardPreviews(db, SCOPE);

    expect(previews).toEqual({
      n1: { hash: HASH_B, url: `https://signed/o/p/card-previews/n1.${HASH_B}.webp` },
      n2: { hash: HASH_A, url: `https://signed/o/p/card-previews/n2.${HASH_A}.webp` }
    });
    expect(bucket.list).toHaveBeenCalledTimes(1);
    expect(bucket.createSignedUrls).toHaveBeenCalledTimes(1);
  });

  it('a project with no previews answers none without signing anything', async () => {
    const { db, bucket } = fakeStorage([]);
    expect(await cardPreviews(db, SCOPE)).toEqual({});
    expect(bucket.createSignedUrls).not.toHaveBeenCalled();
  });

  it('saving a preview stores it under its key and removes the node’s older ones', async () => {
    const { db, bucket } = fakeStorage([
      { name: `n1.${HASH_A}.webp`, updated_at: '2026-10-18T10:00:00Z' },
      { name: `n2.${HASH_A}.webp`, updated_at: '2026-10-18T10:00:00Z' }
    ]);
    const file = new File([new Uint8Array([1, 2, 3])], 'card.webp', { type: 'image/webp' });

    await saveCardPreview(db, { ...SCOPE, nodeId: 'n1', hash: HASH_B, file });

    expect(bucket.upload).toHaveBeenCalledWith(`o/p/card-previews/n1.${HASH_B}.webp`, file, expect.objectContaining({ contentType: 'image/webp' }));
    expect(bucket.remove).toHaveBeenCalledWith([`o/p/card-previews/n1.${HASH_A}.webp`]);
  });

  it('refuses a key that is not a digest, so a name can never climb out of the folder', async () => {
    const { db, bucket } = fakeStorage([]);
    const file = new File([new Uint8Array([1])], 'card.webp', { type: 'image/webp' });
    await expect(saveCardPreview(db, { ...SCOPE, nodeId: 'n1', hash: '../x', file })).rejects.toThrow();
    await expect(saveCardPreview(db, { ...SCOPE, nodeId: '../n1', hash: HASH_A, file })).rejects.toThrow();
    expect(bucket.upload).not.toHaveBeenCalled();
  });
});
