import { describe, expect, it } from 'vitest';
import { IMAGE_MODEL_CHOICES } from '$lib/image-models';
import { KIE_CREDIT_USD } from './kie';
import { KIE_MODELS, kieModelRows } from './kie-catalogue';
import { taskUsdFor } from './generation/task-pricing';

const rows = kieModelRows('2026-10-15T00:00:00.000Z');

describe('the kie catalogue', () => {
  it('only discounts models the picker already offers', () => {
    const offered = new Set(IMAGE_MODEL_CHOICES.map((c) => c.id));
    expect(KIE_MODELS.every((model) => offered.has(model.discountFor))).toBe(true);
  });

  it('prices every line at kie credits times the credit price, the same sum the adapter bills', () => {
    for (const model of KIE_MODELS) {
      const row = rows.find((r) => r.wire_spec.model === model.kieModel)!;
      for (const [resolution, credits] of Object.entries(model.creditsByResolution)) {
        expect(taskUsdFor(row.pricing, { resolution })).toBeCloseTo(credits * KIE_CREDIT_USD, 6);
      }
    }
  });

  it('is never uncensored and always provider kie', () => {
    expect(rows.every((row) => row.provider === 'kie' && row.uncensored === false && row.id.startsWith('kie/'))).toBe(true);
  });
});
