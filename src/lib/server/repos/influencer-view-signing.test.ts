import { describe, expect, it } from 'vitest';
import { signInfluencerViewFiles } from './influencers';

function fakeDb() {
  const transforms: unknown[] = [];
  const bucket = {
    createSignedUrl: async (path: string, _ttl: number, options?: unknown) => {
      transforms.push(options);
      return { data: { signedUrl: `https://signed.example/${path}` }, error: null };
    },
    createSignedUrls: async (paths: string[]) => ({ data: paths.map((path) => ({ path, signedUrl: `https://signed.example/${path}` })), error: null })
  };
  return { transforms, db: { storage: { from: () => bucket } } as never };
}

describe('signInfluencerViewFiles', () => {
  it('a canvas cover is signed as a resized preview, not the original photo', async () => {
    const { db, transforms } = fakeDb();

    const signed = await signInfluencerViewFiles(db, ['catalogue/i1/front.png'], 'canvas512');

    expect(signed.get('catalogue/i1/front.png')).toBe('https://signed.example/catalogue/i1/front.png');
    expect(transforms).toEqual([{ transform: { width: 512, height: 512, resize: 'contain', quality: 75 } }]);
  });
});
