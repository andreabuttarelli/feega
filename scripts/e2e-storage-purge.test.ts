import { describe, expect, it } from 'vitest';
import { purgeStorage, type StoragePort } from '../tests/e2e/fixtures/storage-purge';

function memoryStorage(files: Record<string, string[]>): StoragePort & { files: Record<string, string[]> } {
  const childrenOf = (bucket: string, prefix: string) => {
    const names = files[bucket].filter((p) => p.startsWith(`${prefix}/`)).map((p) => p.slice(prefix.length + 1));
    const seen = new Map<string, boolean>();
    for (const rest of names) {
      const [head, ...tail] = rest.split('/');
      seen.set(head, (seen.get(head) ?? false) || tail.length > 0);
    }
    return [...seen].map(([name, folder]) => ({ name, folder }));
  };
  return {
    files,
    buckets: async () => Object.keys(files),
    list: async (bucket, prefix) => childrenOf(bucket, prefix),
    remove: async (bucket, paths) => {
      files[bucket] = files[bucket].filter((p) => !paths.includes(p));
    }
  };
}

describe('e2e storage teardown', () => {
  it('svuota ogni sottocartella di org e utente in ogni bucket, e niente di altri', async () => {
    const storage = memoryStorage({
      'canvas-assets': ['org/proj/a.png', 'org/proj/imports/b.png', 'org/proj/music/c.mp3', 'org/proj/motion/node/v.mp4', 'other/proj/keep.png'],
      'brand-knowledge': ['user/media/d.png', 'stranger/media/keep.png'],
      media: ['colours/org/ff0000.png', 'user/profile/avatar.png']
    });

    await purgeStorage(storage, ['org', 'user', 'colours/org']);

    expect(storage.files).toEqual({ 'canvas-assets': ['other/proj/keep.png'], 'brand-knowledge': ['stranger/media/keep.png'], media: [] });
  });
});
