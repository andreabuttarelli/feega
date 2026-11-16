import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { zipCode } from './code-zip';

const URL_OK = 'https://cdn.test/hero.png?token=1';
const URL_DOWN = 'https://cdn.test/gone.png?token=2';
const BYTES = new Uint8Array([137, 80, 78, 71]);

const code = {
  files: [{ path: 'src/pages/Page.tsx', content: '<img src="/assets/a.png" /><img src="/assets/b.png" />' }],
  assets: [
    { path: 'public/assets/a.png', ref: '/assets/a.png', url: URL_OK },
    { path: 'public/assets/b.png', ref: '/assets/b.png', url: URL_DOWN }
  ]
};

const fetchBytes = async (url: string) => (url === URL_OK ? BYTES : null);

describe('zipCode', () => {
  it('bundles the image bytes and keeps the remote link only for an image that could not be fetched', async () => {
    const entries = unzipSync(await zipCode('page', code, fetchBytes));

    expect([...entries['page/public/assets/a.png']]).toEqual([...BYTES]);
    expect(entries['page/public/assets/b.png']).toBeUndefined();
    expect(strFromU8(entries['page/src/pages/Page.tsx'])).toBe(`<img src="/assets/a.png" /><img src="${URL_DOWN}" />`);
  });
});

describe('zipCode with a 3D model', () => {
  it('bundles the model file next to the project', async () => {
    const glb = new Uint8Array([0x67, 0x6c, 0x54, 0x46]);
    const model = { path: 'public/assets/toy.glb', ref: '/assets/toy.glb', url: 'https://cdn.test/toy.glb?token=3' };
    const entries = unzipSync(await zipCode('page', { files: [{ path: 'src/scenes.ts', content: '{ "src": "/assets/toy.glb" }' }], assets: [model] }, async () => glb));

    expect([...entries['page/public/assets/toy.glb']]).toEqual([...glb]);
    expect(strFromU8(entries['page/src/scenes.ts'])).toBe('{ "src": "/assets/toy.glb" }');
  });

  it('points the scene at the remote link when the model cannot be fetched', async () => {
    const model = { path: 'public/assets/toy.glb', ref: '/assets/toy.glb', url: 'https://cdn.test/toy.glb?token=3' };
    const entries = unzipSync(await zipCode('page', { files: [{ path: 'src/scenes.ts', content: '{ "src": "/assets/toy.glb" }' }], assets: [model] }, async () => null));

    expect(strFromU8(entries['page/src/scenes.ts'])).toBe(`{ "src": "${model.url}" }`);
  });
});
