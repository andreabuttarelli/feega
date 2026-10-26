import { describe, expect, it } from 'vitest';
import { fetchKieSpecs, specOfDoc } from './kie-docs';

const doc = (summary: string, model: string, input: object, required: string[] = ['prompt']) =>
  '# T\n\n```yaml\n' +
  JSON.stringify({
    paths: { '/api/v1/jobs/createTask': { post: { summary, requestBody: { content: { 'application/json': { schema: { properties: { model: { default: model }, input: { required, properties: input } } } } } } } } }
  }) +
  '\n```\n';

const TEXT_TO_VIDEO = doc('Acme Video', 'acme/text-to-video', {
  prompt: { type: 'string' },
  aspect_ratio: { type: 'string', enum: ['16:9', '9:16'] },
  resolution: { type: 'string', enum: ['720p', '1080P'] },
  duration: { type: 'integer', enum: [5, 10] },
  nsfw_checker: { type: 'boolean' }
});

describe('a kie model doc', () => {
  it('maps the input names the wire understands and keeps the enums', () => {
    expect(specOfDoc(TEXT_TO_VIDEO)).toEqual({
      model: 'acme/text-to-video',
      label: 'Acme Video',
      fields: { prompt: 'prompt', aspectRatio: 'aspect_ratio', resolution: 'resolution', duration: 'duration', images: [] },
      aspectRatios: ['16:9', '9:16'],
      resolutions: ['720p', '1080P'],
      durations: [5, 10],
      numericDuration: true,
      maxRefs: 0
    });
  });

  it('takes optional image lists as references, capped by the doc', () => {
    const spec = specOfDoc(doc('Acme Image', 'acme/image', { prompt: { type: 'string' }, image_urls: { type: 'array', items: { type: 'string' }, maxItems: 4 } }));

    expect(spec).toMatchObject({ fields: { imageList: 'image_urls', images: [] }, maxRefs: 4 });
  });

  it('skips a model that needs an input the wire cannot fill', () => {
    expect(specOfDoc(doc('Edit', 'acme/edit', { prompt: { type: 'string' }, image_url: { type: 'string' } }, ['prompt', 'image_url']))).toBeNull();
    expect(specOfDoc(doc('Moded', 'acme/moded', { prompt: { type: 'string' }, mode: { type: 'string' } }, ['prompt', 'mode']))).toBeNull();
  });

  it('skips a model that is named after the media it must be given', () => {
    const optional = { prompt: { type: 'string' }, image_urls: { type: 'array', items: { type: 'string' } } };

    expect(specOfDoc(doc('I2V', 'acme/image-to-video', optional))).toBeNull();
    expect(specOfDoc(doc('Edit', 'acme/image-edit', optional))).toBeNull();
    expect(specOfDoc(doc('Ext', 'acme/extend', optional))).toBeNull();
  });

  it('skips a page that is not a create-task spec', () => {
    expect(specOfDoc('# nothing here')).toBeNull();
    expect(specOfDoc('```yaml\n: : bad\n```')).toBeNull();
  });
});

describe('fetching the specs', () => {
  it('reads the index and every market doc, ignoring the ones that fail', async () => {
    const pages: Record<string, string> = {
      'https://docs.kie.ai/llms.txt': '- [a](https://docs.kie.ai/market/acme/text-to-video.md)\n- [b](https://docs.kie.ai/market/acme/broken.md)\n- [c](https://docs.kie.ai/suno-api/x.md)',
      'https://docs.kie.ai/market/acme/text-to-video.md': TEXT_TO_VIDEO
    };
    const doFetch = (async (url: string) => (pages[url] ? new Response(pages[url]) : new Response('no', { status: 500 }))) as unknown as typeof fetch;

    const specs = await fetchKieSpecs(doFetch);

    expect(specs.map((s) => s.model)).toEqual(['acme/text-to-video']);
  });

  it('fails when the index itself is unreachable', async () => {
    const doFetch = (async () => new Response('no', { status: 500 })) as unknown as typeof fetch;

    await expect(fetchKieSpecs(doFetch)).rejects.toThrow('kie_docs_failed');
  });
});
