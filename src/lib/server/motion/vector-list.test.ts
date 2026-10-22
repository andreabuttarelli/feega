import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { ItemKind } from '$lib/motion/gpu-full/display-list';
import { addClip } from '$lib/motion/timeline';
import { inlineImages, vectorOf, type Fetcher } from './vector-list';

const png = (bytes: number[], type = 'image/png'): ReturnType<Fetcher> => Promise.resolve({ ok: true, headers: { get: () => type }, arrayBuffer: async () => new Uint8Array(bytes).buffer });

describe('inlineImages', () => {
  it('turns each picture into a data URL, and leaves out one it cannot read', async () => {
    const fetcher: Fetcher = (url) => (url.endsWith('gone.png') ? Promise.resolve({ ok: false, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) }) : png([1, 2, 3]));

    expect(await inlineImages(['https://x.test/a.png', 'https://x.test/gone.png'], fetcher)).toEqual(new Map([['https://x.test/a.png', 'data:image/png;base64,AQID']]));
  });

  it('a download that throws is a missing picture, not a failed export', async () => {
    expect(await inlineImages(['https://x.test/a.png'], () => Promise.reject(new Error('offline')))).toEqual(new Map());
  });
});

describe('vectorOf', () => {
  it('draws the still frame of a doc as its display list', async () => {
    const added = addClip(newMotionDoc(MotionFormat.Square), { component: 'Shape', from: 0, durationInFrames: 90, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.2, height: 0.2, fill: '#00ff00' } }, 'card');
    const doc = added.ok ? added.doc : newMotionDoc(MotionFormat.Square);

    const { list, images } = await vectorOf({ doc, tokens: FEEGA_TOKENS, assets: {} }, { fetcher: () => Promise.reject(new Error('no network')), fonts: async () => () => null });

    expect(list.items.some((i) => i.kind === ItemKind.Path && i.clip === 'card')).toBe(true);
    expect(images.size).toBe(0);
  });
});
