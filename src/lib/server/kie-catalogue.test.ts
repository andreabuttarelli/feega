import { describe, expect, it } from 'vitest';
import { IMAGE_MODEL_CHOICES } from '$lib/image-models';
import { VIDEO_MODEL_CHOICES } from '$lib/video-models';
import { IMAGE_TOOLS_GROUP, IMAGE_TOOL_MODEL, ImageTool } from '$lib/image-tools';
import { KIE_CREDIT_USD } from './kie';
import { KieBilling, KIE_MODELS, kieModelRows } from './kie-catalogue';
import { KIE_FIXTURE_PRICES } from './kie-pricing.fixtures';
import type { KieSpec } from './kie-docs';
import { taskUsdFor } from './generation/task-pricing';

const SPEC = (over: Partial<KieSpec>): KieSpec => ({ model: 'acme/text-to-video', label: 'Acme Video', fields: { prompt: 'prompt', aspectRatio: 'aspect_ratio', resolution: 'resolution', duration: 'duration', images: [] }, aspectRatios: ['16:9'], resolutions: ['720p'], durations: [5, 10], numericDuration: true, maxRefs: 0, ...over });

const rows = kieModelRows(KIE_FIXTURE_PRICES, [], '2026-10-15T00:00:00.000Z');

describe('the kie catalogue', () => {
  it('only discounts models the picker already offers', () => {
    const offered = new Set([...IMAGE_MODEL_CHOICES, ...VIDEO_MODEL_CHOICES].map((c) => c.id));
    expect(KIE_MODELS.filter((model) => model.discountFor).every((model) => offered.has(model.discountFor!))).toBe(true);
  });

  it('prices every line at the live kie credits times the credit price, the same sum the adapter bills', () => {
    const banana = rows.find((r) => r.id === 'kie/nano-banana-2')!;

    expect(banana.supported_resolutions).toEqual(['1K', '2K', '4K']);
    expect(taskUsdFor(banana.pricing, { resolution: '1K' })).toBeCloseTo(8 * KIE_CREDIT_USD, 6);
    expect(taskUsdFor(banana.pricing, { resolution: '4K' })).toBeCloseTo(18 * KIE_CREDIT_USD, 6);
  });

  it('prices nano banana pro from the shared 1/2K line and the 4K line', () => {
    const pro = rows.find((r) => r.id === 'kie/nano-banana-pro')!;

    expect(taskUsdFor(pro.pricing, { resolution: '2K' })).toBeCloseTo(18 * KIE_CREDIT_USD, 6);
    expect(taskUsdFor(pro.pricing, { resolution: '4K' })).toBeCloseTo(24 * KIE_CREDIT_USD, 6);
  });

  it('leaves a curated model out when the price list no longer has it, so its stored row stays', () => {
    const without = kieModelRows(new Map(), [], '2026-10-15T00:00:00.000Z');

    expect(without).toEqual([]);
  });

  it('adds a kie-only model from its doc and price, wired by the doc and priced per second', () => {
    const added = kieModelRows(KIE_FIXTURE_PRICES, [SPEC({})], '2026-10-15T00:00:00.000Z').find((r) => r.id === 'kie/acme/text-to-video')!;

    expect(added.catalogue).toBe('video');
    expect(added.wire_spec).toMatchObject({ model: 'acme/text-to-video', numeric: ['duration'], defaults: { resolution: '720p' } });
    expect(added.wire_spec.discountFor).toBeUndefined();
    expect(taskUsdFor(added.pricing, { resolution: '720p', duration: '10' })).toBeCloseTo(30 * KIE_CREDIT_USD, 6);
    expect(added.param_schema).toMatchObject({ aspect_ratio: { values: ['16:9'] }, duration: { values: ['5', '10'] } });
  });

  it('routes a kie twin of an offered model as its discount, and leaves other kie-only models alone', () => {
    const twin = kieModelRows(KIE_FIXTURE_PRICES, [SPEC({ model: 'qwen3/pro-text-to-image', fields: { prompt: 'prompt', images: [] }, resolutions: [], durations: [], aspectRatios: [] })], '2026-10-15T00:00:00.000Z');

    expect(twin.find((r) => r.id === 'kie/qwen3/pro-text-to-image')?.wire_spec.discountFor).toBe('qwen3-pro');
  });

  it('prices a model whose doc has no resolution input by one flat line, whatever the list says', () => {
    const lite = kieModelRows(KIE_FIXTURE_PRICES, [SPEC({ model: 'nano-banana-2-lite', fields: { prompt: 'prompt', images: [], imageList: 'image_urls' }, resolutions: [], durations: [], aspectRatios: ['1:1'] })], '2026-10-15T00:00:00.000Z').find((r) => r.id === 'kie/nano-banana-2-lite')!;

    expect(lite.supported_resolutions).toEqual([]);
    expect(taskUsdFor(lite.pricing, {})).toBeCloseTo(4 * KIE_CREDIT_USD, 6);
  });

  it('flags a model that needs an image so a node without one is refused before kie is called', () => {
    const edit = kieModelRows(KIE_FIXTURE_PRICES, [SPEC({ model: 'qwen/text-to-image', fields: { prompt: 'prompt', images: ['image_url'] }, requiresImage: true, resolutions: [], durations: [], aspectRatios: [] })], '2026-10-15T00:00:00.000Z').find((r) => r.id === 'kie/qwen/text-to-image')!;

    expect(edit.wire_spec).toMatchObject({ requiresImage: true });
    expect(edit.input_modalities).toEqual(['text', 'image']);
  });

  it('maps the kie twin of an offered video model as its discount', () => {
    const rows = kieModelRows(KIE_FIXTURE_PRICES, [SPEC({ model: 'bytedance/seedance-2' })], '2026-10-15T00:00:00.000Z');

    expect(rows.find((r) => r.id === 'kie/bytedance/seedance-2')?.wire_spec.discountFor).toBe('bytedance/seedance-2');
  });

  it('prices a model with no resolution input by one flat line', () => {
    const qwen = kieModelRows(KIE_FIXTURE_PRICES, [SPEC({ model: 'qwen/text-to-image', fields: { prompt: 'prompt', images: [] }, resolutions: [], durations: [], aspectRatios: [] })], '2026-10-15T00:00:00.000Z').find((r) => r.id === 'kie/qwen/text-to-image')!;

    expect(qwen.catalogue).toBe('image');
    expect(qwen.supported_resolutions).toEqual([]);
    expect(taskUsdFor(qwen.pricing, {})).toBeCloseTo(2 * KIE_CREDIT_USD, 6);
  });

  it('does not list an image tool a second time as a plain model', () => {
    const doubled = kieModelRows(KIE_FIXTURE_PRICES, [SPEC({ model: 'recraft/remove-background', resolutions: [], durations: [], aspectRatios: [] })], '2026-10-15T00:00:00.000Z');

    expect(doubled.filter((r) => r.wire_spec.model === 'recraft/remove-background')).toHaveLength(1);
  });

  it('does not list an image tool a second time as a plain model', () => {
    const doubled = kieModelRows(KIE_FIXTURE_PRICES, [SPEC({ model: 'recraft/remove-background', resolutions: [], durations: [], aspectRatios: [] })], '2026-10-15T00:00:00.000Z');

    expect(doubled.filter((r) => r.wire_spec.model === 'recraft/remove-background')).toHaveLength(1);
  });

  it('skips a doc whose model the price list does not know, and never doubles a curated model', () => {
    const extra = kieModelRows(KIE_FIXTURE_PRICES, [SPEC({ model: 'ghost/model' }), SPEC({ model: 'nano-banana-2' })], '2026-10-15T00:00:00.000Z');

    expect(extra.map((r) => r.id).filter((id) => id === 'kie/ghost/model')).toEqual([]);
    expect(extra.filter((r) => r.id === 'kie/nano-banana-2')).toHaveLength(1);
  });

  it('offers Grok Imagine text-to-video on kie alone, priced per second', () => {
    const grok = rows.find((r) => r.id === 'kie/grok-imagine/text-to-video')!;

    expect(grok.catalogue).toBe('video');
    expect(grok.wire_spec).toMatchObject({ model: 'grok-imagine/text-to-video', numeric: ['duration'] });
    expect(grok.wire_spec.discountFor).toBeUndefined();
    expect(taskUsdFor(grok.pricing, { resolution: '480p', duration: '6' })).toBeCloseTo(6 * 2.4 * KIE_CREDIT_USD, 6);
    expect(taskUsdFor(grok.pricing, { resolution: '720p', duration: '10' })).toBeCloseTo(10 * 4.5 * KIE_CREDIT_USD, 6);
    expect(grok.param_schema).toMatchObject({ duration: { type: 'enum', values: ['6', '10', '15', '20', '30'] } });
  });

  it('offers background removal as an image-only tool in the Image tools group, one flat price', () => {
    const tool = rows.find((r) => r.id === IMAGE_TOOL_MODEL[ImageTool.RemoveBackground])!;

    expect(tool.catalogue).toBe('image');
    expect(tool.wire_spec).toMatchObject({ model: 'recraft/remove-background', requiresImage: true, menuGroup: IMAGE_TOOLS_GROUP, fields: { images: ['image'] } });
    expect(taskUsdFor(tool.pricing, {})).toBeCloseTo(1 * KIE_CREDIT_USD, 6);
  });

  it('offers layer decomposition taking a prompt and keeping the extra outputs as layers', () => {
    const tool = rows.find((r) => r.id === IMAGE_TOOL_MODEL[ImageTool.SplitLayers])!;

    expect(tool.wire_spec).toMatchObject({ model: 'seedream/5-flash-layer-decomposition', requiresImage: true, layers: true, menuGroup: IMAGE_TOOLS_GROUP, fields: { prompt: 'prompt', images: ['image_url'] } });
    expect(taskUsdFor(tool.pricing, {})).toBeGreaterThan(0);
  });

  it('offers inpainting taking a prompt, the picture and a mask, priced by rendering speed', () => {
    const tool = rows.find((r) => r.id === IMAGE_TOOL_MODEL[ImageTool.Inpaint])!;

    expect(tool.wire_spec).toMatchObject({
      model: 'ideogram/v3-edit',
      requiresImage: true,
      requiresMask: true,
      menuGroup: IMAGE_TOOLS_GROUP,
      fields: { prompt: 'prompt', images: ['image_url'], mask: 'mask_url' }
    });
    expect(tool.param_schema).toMatchObject({ rendering_speed: { type: 'enum', values: ['TURBO', 'BALANCED', 'QUALITY'] } });
    expect(taskUsdFor(tool.pricing, { rendering_speed: 'TURBO' })).toBeLessThan(taskUsdFor(tool.pricing, { rendering_speed: 'QUALITY' })!);
  });

  it('offers the image upscale at one flat price', () => {
    const tool = rows.find((r) => r.id === IMAGE_TOOL_MODEL[ImageTool.Upscale])!;

    expect(tool.wire_spec).toMatchObject({ model: 'recraft/crisp-upscale', requiresImage: true, menuGroup: IMAGE_TOOLS_GROUP, fields: { images: ['image'] } });
    expect(tool.param_schema).toEqual({});
    expect(taskUsdFor(tool.pricing, {})).toBeCloseTo(0.5 * KIE_CREDIT_USD, 6);
  });

  it('is never uncensored and always provider kie', () => {
    expect(rows.every((row) => row.provider === 'kie' && row.uncensored === false && row.id.startsWith('kie/'))).toBe(true);
  });
});
