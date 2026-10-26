import { describe, expect, it } from 'vitest';
import { fetchHiggsfieldModels, modelFromDoc, parseModelDoc, withDiscovered } from './higgsfield-docs';
import { HIGGSFIELD_MODELS, higgsfieldModelRows, type HiggsfieldModel } from './higgsfield-catalogue';
import {
  HF_DOC_KLING_MOTION,
  HF_DOC_KLING_TEXT,
  HF_DOC_QWEN_IMAGE,
  HF_DOC_SEEDANCE_EXTEND,
  HF_DOC_WAN_REFERENCE
} from './higgsfield-docs.fixtures';

const MODELS_BASE = 'https://docs.higgsfield.ai/docs/models';

const modelOf = (doc: { markdown: string }): HiggsfieldModel | null => {
  const parsed = parseModelDoc(doc.markdown);
  return parsed ? modelFromDoc(parsed) : null;
};

const SITEMAP = `<urlset>
<loc>${MODELS_BASE}</loc>
<loc>${MODELS_BASE}/wan-2-7</loc>
<loc>${MODELS_BASE}/${HF_DOC_WAN_REFERENCE.slug}</loc>
<loc>${MODELS_BASE}/${HF_DOC_KLING_TEXT.slug}</loc>
<loc>https://docs.higgsfield.ai/docs/quickstart</loc>
</urlset>`;

const docsSite = (pages: Record<string, string>): typeof fetch =>
  (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/sitemap.xml')) {
      return new Response(SITEMAP);
    }
    const body = pages[url];
    return body === undefined ? new Response('not found', { status: 404 }) : new Response(body);
  }) as typeof fetch;

describe('Higgsfield model docs', () => {
  it('reads the endpoint and every input from a model page', () => {
    const doc = parseModelDoc(HF_DOC_KLING_TEXT.markdown)!;
    expect(doc.path).toBe('kling-video/v2.5-turbo/pro/text-to-video');
    expect(doc.fields.find((f) => f.name === 'prompt')).toMatchObject({ required: true });
    expect(doc.fields.find((f) => f.name === 'duration')).toMatchObject({ values: [5, 10] });
  });

  it('a page without an endpoint is not a model', () => {
    expect(parseModelDoc('# Kling 2.5 Turbo\n\nOverview only')).toBeNull();
  });

  it('maps a text-to-video page to the wire fields and the prices to ask for', () => {
    const model = modelOf(HF_DOC_KLING_TEXT)!;
    expect(model).toMatchObject({
      path: 'kling-video/v2.5-turbo/pro/text-to-video',
      catalogue: 'video',
      fields: { prompt: 'prompt', duration: 'duration', images: [] },
      numeric: ['duration'],
      priceBy: [{ key: 'duration', values: [5, 10] }]
    });
  });

  it('maps reference lists, resolution and aspect ratio, and prices a duration range', () => {
    const model = modelOf(HF_DOC_WAN_REFERENCE)!;
    expect(model.fields).toMatchObject({ imageList: 'image_urls', videoList: 'video_urls', resolution: 'resolution', aspectRatio: 'aspect_ratio' });
    expect(model.priceBy).toEqual([
      { key: 'duration', values: [2, 3, 4, 5, 6, 7, 8, 9, 10] },
      { key: 'resolution', values: ['720p', '1080p'] }
    ]);
  });

  it('leaves the price to the submit when the variants are too many to ask', () => {
    const model = modelOf(HF_DOC_SEEDANCE_EXTEND)!;
    expect(model.priceBy).toEqual([]);
    expect(model.wire).toMatchObject({ requiresVideo: true, quotedAtSubmit: true });
    expect(model.fields.video).toBe('video_url');
  });

  it('files an image page under image and asks for the image and video a page requires', () => {
    expect(modelOf(HF_DOC_QWEN_IMAGE)).toMatchObject({ catalogue: 'image', priceBy: [{ key: 'resolution', values: ['1k', '2k'] }] });
    const motion = modelOf(HF_DOC_KLING_MOTION)!;
    expect(motion.wire).toMatchObject({ requiresImage: true, requiresVideo: true });
    expect(motion.estimateBase).toMatchObject({ image_url: expect.any(String), video_url: expect.any(String) });
  });

  it('skips a page that requires an input we cannot fill', () => {
    const doc = '# X\n\n**Endpoint ID:** `x/y`\n\n## Input schema\n\n**prompt** `string` *required*\n\nText\n\n**palette** `object` *required*\n\nColours\n';
    expect(parseModelDoc(doc)).not.toBeNull();
    expect(modelFromDoc(parseModelDoc(doc)!)).toBeNull();
  });

  it('discovers the models listed in the sitemap, skipping pages that fail', async () => {
    const fetched = await fetchHiggsfieldModels(docsSite({ [`${MODELS_BASE}/${HF_DOC_KLING_TEXT.slug}.md`]: HF_DOC_KLING_TEXT.markdown }));
    expect(fetched.map((m) => m.path)).toEqual(['kling-video/v2.5-turbo/pro/text-to-video']);
  });

  it('a sitemap that cannot be read fails the discovery instead of returning nothing', async () => {
    const down = (async () => new Response('', { status: 503 })) as typeof fetch;
    await expect(fetchHiggsfieldModels(down)).rejects.toThrow(/higgsfield_docs_failed/);
  });

  it('keeps the hand-wired model when the docs list the same endpoint, and adds the rest', () => {
    const hand = HIGGSFIELD_MODELS.find((m) => m.path === 'kling-video/v2.5-turbo/pro/text-to-video')!;
    const fromDocs = { ...modelOf(HF_DOC_KLING_TEXT)!, label: 'from docs' };
    const wan = modelOf(HF_DOC_WAN_REFERENCE)!;
    const merged = withDiscovered(HIGGSFIELD_MODELS, [fromDocs, wan]);

    expect(merged.find((m) => m.path === hand.path)).toBe(hand);
    expect(merged.find((m) => m.path === wan.path)).toBe(wan);
    expect(merged).toHaveLength(HIGGSFIELD_MODELS.length + 1);
  });

  it('prices a discovered model through the estimate and offers it like a hand-wired one', async () => {
    const wan = modelOf(HF_DOC_WAN_REFERENCE)!;
    const asked: Record<string, unknown>[] = [];
    const estimate = async (_path: string, inputs: Record<string, unknown>) => {
      asked.push(inputs);
      return 0.5;
    };

    const { rows } = await higgsfieldModelRows({ estimate }, '2026-10-26T00:00:00.000Z', [wan]);

    expect(rows.map((r) => r.id)).toEqual(['higgsfield/wan/v2.7/reference-to-video']);
    expect(asked).toHaveLength(18);
    expect(asked[0]).toMatchObject({ prompt: expect.any(String), duration: 2, resolution: '720p' });
  });
});
