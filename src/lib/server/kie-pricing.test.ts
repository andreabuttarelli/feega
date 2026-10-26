import { describe, expect, it } from 'vitest';
import { creditsBy, fetchKiePrices, KieUnit, pricesOf } from './kie-pricing';

const record = (modelDescription: string, creditPrice: string, creditUnit: string, anchor: string, interfaceType = 'image') => ({ modelDescription, creditPrice, creditUnit, anchor, interfaceType });

const RECORDS = [
  record('Google nano banana 2, 1K', '8', 'per image', 'https://kie.ai/nano-banana-2'),
  record('Google nano banana 2, 4K', '18', 'per image', 'https://kie.ai/nano-banana-2'),
  record('Google nano banana pro, 1/2K', '18.0', 'per image', 'https://kie.ai/nano-banana-pro'),
  record('grok-imagine, text-to-video, 720p', '4.5', 'per second', 'https://kie.ai/grok-imagine?model=grok-imagine%2Ftext-to-video', 'video'),
  record('grok-imagine, upscale, 720P → 1080P', '20', 'per upscale', 'https://kie.ai/grok-imagine?model=grok-imagine%2Fupscale', 'video'),
  record('ideogram v3-edit, image-to-image, TURBO', '3.5', 'per image', 'https://kie.ai/ideogram/v3?model=ideogram%2Fv3-edit'),
  record('grok-4-7, Chat, Input', '160', 'per million tokens', 'https://kie.ai/grok-4-7', 'chat')
];

const resolutionOf = (line: { resolution: string | null }) => line.resolution;

describe('the kie price list', () => {
  it('keys every model by the id the API takes, from the model query or the page slug', () => {
    const prices = pricesOf(RECORDS);

    expect([...prices.keys()].sort()).toEqual(['grok-imagine-text-to-video', 'ideogram-v3-edit', 'nano-banana-2', 'nano-banana-pro']);
  });

  it('reads the resolution out of the description and splits a shared "1/2K" line', () => {
    const prices = pricesOf(RECORDS);

    expect(creditsBy(prices.get('nano-banana-2')!.lines, KieUnit.Image, resolutionOf)).toEqual({ '1K': 8, '4K': 18 });
    expect(creditsBy(prices.get('nano-banana-pro')!.lines, KieUnit.Image, resolutionOf)).toEqual({ '1K': 18, '2K': 18 });
    expect(creditsBy(prices.get('grok-imagine-text-to-video')!.lines, KieUnit.Second, resolutionOf)).toEqual({ '720p': 4.5 });
  });

  it('reads the rendering tier and drops units it cannot bill', () => {
    const prices = pricesOf(RECORDS);

    expect(creditsBy(prices.get('ideogram-v3-edit')!.lines, KieUnit.Image, (line) => line.tier)).toEqual({ TURBO: 3.5 });
  });

  it('keeps the dearest line when a model has two for the same resolution', () => {
    const prices = pricesOf([
      record('v6, 360p(no audio)', '4.8', 'per second', 'https://kie.ai/v6?model=v6%2Ftext-to-video', 'video'),
      record('v6, 360p(with audio)', '7.2', 'per second', 'https://kie.ai/v6?model=v6%2Ftext-to-video', 'video')
    ]);

    expect(creditsBy(prices.get('v6-text-to-video')!.lines, KieUnit.Second, resolutionOf)).toEqual({ '360p': 7.2 });
  });

  it('walks every page of the list', async () => {
    const calls: number[] = [];
    const doFetch = (async (_url: string, init: RequestInit) => {
      const { pageNum } = JSON.parse(String(init.body));
      calls.push(pageNum);
      return new Response(JSON.stringify({ code: 200, data: { pages: 2, records: [pageNum === 1 ? RECORDS[0] : RECORDS[3]] } }));
    }) as unknown as typeof fetch;

    const prices = await fetchKiePrices(doFetch);

    expect(calls.sort()).toEqual([1, 2]);
    expect(prices.size).toBe(2);
  });

  it('refuses an empty list or an error reply, so the previous rows stay', async () => {
    const reply = (body: unknown) => (async () => new Response(JSON.stringify(body))) as unknown as typeof fetch;

    await expect(fetchKiePrices(reply({ code: 200, data: { pages: 1, records: [] } }))).rejects.toThrow('kie_pricing_failed');
    await expect(fetchKiePrices(reply({ code: 422, msg: 'bad', data: null }))).rejects.toThrow('kie_pricing_failed: 422 bad');
  });
});
