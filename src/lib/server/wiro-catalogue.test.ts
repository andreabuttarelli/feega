import { describe, expect, it, vi } from 'vitest';
import fixture from './wiro-tool-list.fixture.json';
import fixture3d from './wiro-3d-tool-list.fixture.json';
import { fetchWiroCatalogue, wiroModelRow, wiroUsdFor } from './wiro-catalogue';

const SYNCED = '2026-09-29T00:00:00.000Z';
const tool = (title: string) => fixture.tool.find((t) => t.title === title)!;

describe('a Wiro tool becomes an ai_models row', () => {
  it('maps an uncensored text-to-image model with its controls, price and wiring', () => {
    const row = wiroModelRow(tool('Z Image Uncensored (Wiro-Partners)'), SYNCED)!;

    expect(row).toMatchObject({
      id: 'wiro/wiro-partners/z-image-uncensored',
      catalogue: 'image',
      provider: 'wiro',
      label: 'Z Image Uncensored (Wiro-Partners)',
      input_modalities: ['text'],
      output_modalities: ['image'],
      uncensored: true,
      released_at: new Date(1790174561 * 1000).toISOString(),
      wire_spec: { owner: 'wiro-partners', project: 'z-image-uncensored', fields: { prompt: 'prompt', aspectRatio: 'ratio', images: [] } }
    });
    expect(row.param_schema).toMatchObject({
      aspect_ratio: { type: 'enum', values: expect.arrayContaining(['16:9', '9:16', '1:1']) },
      promptExtend: { type: 'enum', values: ['false', 'true'] }
    });
    expect(row.pricing).toEqual({
      lines: [
        { inputs: { promptExtend: 'false' }, usd: 0.013, method: 'cpr' },
        { inputs: { promptExtend: 'true' }, usd: 0.014, method: 'cpr' }
      ]
    });
  });

  it('maps a video model with duration, resolution, first and last frame', () => {
    const row = wiroModelRow(tool('Wan 3.0 Uncensored Video Generator'), SYNCED)!;

    expect(row.catalogue).toBe('video');
    expect(row.input_modalities).toEqual(['text', 'image']);
    expect(row.supported_resolutions).toEqual(['480p', '720p', '1080p']);
    expect(row.wire_spec).toMatchObject({
      fields: { prompt: 'prompt', aspectRatio: 'ratio', resolution: 'resolution', duration: 'duration', images: ['inputImage'], lastFrame: 'inputImageLast' }
    });
    expect(row.param_schema).toMatchObject({ duration: { type: 'enum', values: ['5', '10', '15', '20', '25', '30'] } });
  });

  it('keeps a safe model unflagged', () => {
    expect(wiroModelRow(tool('Alibaba Qwen Image 3.0 Pro'), SYNCED)).toMatchObject({ uncensored: false, catalogue: 'image' });
  });
});

describe('a Wiro 3D tool becomes a model3d row', () => {
  const tool3d = (project: string) => fixture3d.tool.find((t) => t.cleanslugproject === project)!;

  it('maps an image-to-3D tool without a prompt: the image is its only input', () => {
    const row = wiroModelRow(tool3d('trellis-2'), SYNCED)!;

    expect(row).toMatchObject({
      id: 'wiro/microsoft/trellis-2',
      catalogue: 'model3d',
      input_modalities: ['image'],
      output_modalities: ['model3d'],
      wire_spec: { owner: 'microsoft', project: 'trellis-2', fields: { images: ['inputImage'] } }
    });
    expect(row.wire_spec.fields.prompt).toBeUndefined();
    expect(row.param_schema).toMatchObject({ pipeline_type: { type: 'enum', values: ['512', '1024_cascade', '1536_cascade'] } });
    expect(wiroUsdFor(row.pricing, { pipeline_type: '512' })).toBe(0.25);
  });

  it('prices Hunyuan3D by texture', () => {
    const row = wiroModelRow(tool3d('hunyuan3d-2-1'), SYNCED)!;

    expect(row.catalogue).toBe('model3d');
    expect(wiroUsdFor(row.pricing, { generate_texture: 'true' })).toBe(0.9);
  });
});

describe('fetching the Wiro catalogue', () => {
  it('asks for the 3D generation category too', async () => {
    const fetchFn = vi.fn(async () => Response.json(fixture3d));
    const out = await fetchWiroCatalogue(fetchFn as unknown as typeof fetch, 'https://wiro.test/v1', SYNCED);

    const bodies = fetchFn.mock.calls.map((call) => JSON.parse(String((call as unknown as [string, RequestInit])[1].body)));
    expect(bodies).toEqual(expect.arrayContaining([expect.objectContaining({ categories: ['3d-generation'] })]));
    expect(out.rows.map((r) => r.id)).toContain('wiro/tencentarc/pixal3d');
  });

  it('reads text-to-image, text-to-video and the uncensored search, once per model', async () => {
    const fetchFn = vi.fn(async () => Response.json(fixture));
    const out = await fetchWiroCatalogue(fetchFn as unknown as typeof fetch, 'https://wiro.test/v1', SYNCED);

    expect(out.ok).toBe(true);
    const bodies = fetchFn.mock.calls.map((call) => JSON.parse(String((call as unknown as [string, RequestInit])[1].body)));
    expect(bodies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ categories: ['text-to-image'] }),
        expect.objectContaining({ categories: ['text-to-video'] }),
        expect.objectContaining({ search: 'uncensored' })
      ])
    );
    expect(new Set(out.rows.map((r) => r.id)).size).toBe(out.rows.length);
  });

  it('reports a failure without rows when Wiro is down', async () => {
    const out = await fetchWiroCatalogue((async () => new Response('', { status: 503 })) as unknown as typeof fetch, 'https://wiro.test/v1', SYNCED);
    expect(out).toMatchObject({ ok: false, rows: [] });
  });
});

describe('pricing a Wiro run', () => {
  const pricing = {
    lines: [
      { inputs: { resolution: '480p', duration: '5' }, usd: 0.25, method: 'cpr' },
      { inputs: { resolution: '720p', duration: '5' }, usd: 0.5, method: 'cpr' }
    ]
  };

  it('picks the line whose inputs match the chosen settings', () => {
    expect(wiroUsdFor(pricing, { resolution: '720p', duration: '5' })).toBe(0.5);
  });

  it('is unknown when no line matches', () => {
    expect(wiroUsdFor(pricing, { resolution: '1080p', duration: '5' })).toBeNull();
  });

  it('is unknown for a per-output-second price', () => {
    expect(wiroUsdFor({ lines: [{ inputs: {}, usd: 0, method: 'cp-readoutput' }] }, {})).toBeNull();
  });
});
