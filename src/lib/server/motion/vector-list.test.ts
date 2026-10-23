import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { ItemKind } from '$lib/motion/gpu-full/display-list';
import { addClip } from '$lib/motion/timeline';
import { LOTTIE_MAX_SECONDS, Span, inlineImages, vectorOf, type Fetcher } from './vector-list';

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

const shapeDoc = (seconds: number) => {
  const base = { ...newMotionDoc(MotionFormat.Square), durationInFrames: seconds * 30 };
  const added = addClip(base, { component: 'Shape', from: 0, durationInFrames: seconds * 30, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.2, height: 0.2, fill: '#00ff00' } }, 'card');
  return added.ok ? added.doc : base;
};

const offline = { fetcher: () => Promise.reject(new Error('no network')), fonts: async () => () => null };

describe('vectorOf', () => {
  it('draws the still frame of a doc as its display list', async () => {
    const { lists, images } = await vectorOf({ doc: shapeDoc(3), tokens: FEEGA_TOKENS, assets: {} }, Span.Still, offline);

    expect(lists).toHaveLength(1);
    expect(lists[0].items.some((i) => i.kind === ItemKind.Path && i.clip === 'card')).toBe(true);
    expect(images.size).toBe(0);
  });

  it('draws every frame of an animation, one list per frame', async () => {
    const { lists } = await vectorOf({ doc: shapeDoc(2), tokens: FEEGA_TOKENS, assets: {} }, Span.Whole, offline);

    expect(lists).toHaveLength(60);
  });

  it('a still doc has one frame even when the whole span is asked', async () => {
    const still = { ...shapeDoc(3), still: { frame: 30 } };
    const { lists } = await vectorOf({ doc: still, tokens: FEEGA_TOKENS, assets: {} }, Span.Whole, offline);

    expect(lists).toHaveLength(1);
  });

  it('refuses an animation longer than the Lottie cap', async () => {
    await expect(vectorOf({ doc: shapeDoc(LOTTIE_MAX_SECONDS + 1), tokens: FEEGA_TOKENS, assets: {} }, Span.Whole, offline)).rejects.toThrow(/at most 30 s/);
  });
});
