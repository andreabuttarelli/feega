import { afterEach, describe, expect, it, vi } from 'vitest';
import { inlineMedia } from './inline-media';

type FakeEl = { tagName: string; src?: string; style: Record<string, string> & { setProperty: (k: string, v: string) => void }; bg: string };

function el(tagName: string, init: { src?: string; bg?: string } = {}): FakeEl {
  const style = { setProperty(k: string, v: string) { (style as Record<string, unknown>)[k] = v; } } as FakeEl['style'];
  return { tagName, src: init.src, style, bg: init.bg ?? 'none' };
}

describe('inlineMedia', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('swaps every remote picture for one small inline copy, fetched once per url across frames', async () => {
    const img = el('IMG', { src: 'https://cdn/tee.png' });
    const card = el('DIV', { bg: 'url("https://cdn/tee.png")' });
    const plain = el('DIV');
    const done = el('IMG', { src: 'data:image/png;base64,AA' });
    const root = { querySelectorAll: () => [img, card, plain, done] } as unknown as Element;
    vi.stubGlobal('getComputedStyle', (e: FakeEl) => ({ backgroundImage: e.bg }));
    const shrink = vi.fn(async (url: string) => `data:image/webp;base64,${url.length}`);
    const cache = new Map<string, Promise<string>>();

    await inlineMedia(root, shrink, cache);
    await inlineMedia(root, shrink, cache);

    expect(shrink).toHaveBeenCalledTimes(1);
    expect(img.src).toBe('data:image/webp;base64,19');
    expect(card.style['background-image']).toBe('url("data:image/webp;base64,19")');
    expect(plain.style['background-image']).toBeUndefined();
    expect(done.src).toBe('data:image/png;base64,AA');
  });

  it('a layered background keeps every layer and inlines each picture in it', async () => {
    const text = el('SPAN', { bg: 'linear-gradient(rgb(0, 0, 0), rgb(0, 0, 0)), url("https://cdn/a.png"), url("https://cdn/bb.png")' });
    const root = { querySelectorAll: () => [text] } as unknown as Element;
    vi.stubGlobal('getComputedStyle', (e: FakeEl) => ({ backgroundImage: e.bg }));

    await inlineMedia(root, async (url) => `data:${url.length}`, new Map());

    expect(text.style['background-image']).toBe('linear-gradient(rgb(0, 0, 0), rgb(0, 0, 0)), url("data:17"), url("data:18")');
  });
});
