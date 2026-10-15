import { describe, expect, it } from 'vitest';
import { IMAGE_MODEL_CHOICES } from '$lib/image-models';
import { KIE_CREDIT_USD } from './kie';
import { KieBilling, KIE_MODELS, kieModelRows } from './kie-catalogue';
import { taskUsdFor } from './generation/task-pricing';

const rows = kieModelRows('2026-10-15T00:00:00.000Z');

describe('the kie catalogue', () => {
  it('only discounts models the picker already offers', () => {
    const offered = new Set(IMAGE_MODEL_CHOICES.map((c) => c.id));
    expect(KIE_MODELS.filter((model) => model.discountFor).every((model) => offered.has(model.discountFor!))).toBe(true);
  });

  it('prices every line at kie credits times the credit price, the same sum the adapter bills', () => {
    for (const model of KIE_MODELS.filter((m) => m.billing === KieBilling.PerRun)) {
      const row = rows.find((r) => r.wire_spec.model === model.kieModel)!;
      for (const [resolution, credits] of Object.entries(model.creditsByResolution)) {
        expect(taskUsdFor(row.pricing, { resolution })).toBeCloseTo(credits * KIE_CREDIT_USD, 6);
      }
    }
  });

  it('offers Grok Imagine text-to-video on kie alone, priced per second from kie\'s price list', () => {
    const grok = rows.find((r) => r.id === 'kie/grok-imagine/text-to-video')!;

    expect(grok.catalogue).toBe('video');
    expect(grok.wire_spec).toMatchObject({ model: 'grok-imagine/text-to-video', numeric: ['duration'] });
    expect(grok.wire_spec.discountFor).toBeUndefined();
    expect(taskUsdFor(grok.pricing, { resolution: '480p', duration: '6' })).toBeCloseTo(6 * 2.4 * KIE_CREDIT_USD, 6);
    expect(taskUsdFor(grok.pricing, { resolution: '720p', duration: '10' })).toBeCloseTo(10 * 4.5 * KIE_CREDIT_USD, 6);
    expect(grok.param_schema).toMatchObject({ duration: { type: 'enum', values: ['6', '10', '15', '20', '30'] } });
  });

  it('is never uncensored and always provider kie', () => {
    expect(rows.every((row) => row.provider === 'kie' && row.uncensored === false && row.id.startsWith('kie/'))).toBe(true);
  });
});
