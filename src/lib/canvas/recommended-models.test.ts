import { describe, it, expect } from 'vitest';
import {
  recommend,
  modelAdvice,
  withRecommendations,
  RECOMMENDATION_EXCLUSIONS,
  type CandidateModel
} from './recommended-models';

const NOW = new Date('2026-09-29T00:00:00Z');

function model(over: Partial<CandidateModel> & { id: string }): CandidateModel {
  return {
    label: over.id,
    releasedAt: '2026-08-01T00:00:00Z',
    expiresAt: null,
    unitCostUsd: 0.04,
    benchmark: null,
    capability: 1,
    ...over
  };
}

function tier(list: ReturnType<typeof recommend>, name: string) {
  return list.find((r) => r.tier === name)?.id;
}

describe('recommend', () => {
  it('a newer model beats an older one at a similar price', () => {
    const list = recommend('image', [
      model({ id: 'old', releasedAt: '2025-03-01T00:00:00Z', unitCostUsd: 0.04 }),
      model({ id: 'new', releasedAt: '2026-09-01T00:00:00Z', unitCostUsd: 0.041 })
    ], NOW);

    expect(tier(list, 'best')).toBe('new');
    expect(tier(list, 'balanced')).toBe('new');
  });

  it('an expired model is never recommended', () => {
    const list = recommend('text', [
      model({ id: 'expired', benchmark: 90, expiresAt: '2026-09-01T00:00:00Z' }),
      model({ id: 'live', benchmark: 40 })
    ], NOW);

    expect(list.map((r) => r.id)).not.toContain('expired');
    expect(tier(list, 'best')).toBe('live');
  });

  it('a model without a known price is never recommended', () => {
    const list = recommend('image', [
      model({ id: 'unpriced', unitCostUsd: null, releasedAt: '2026-09-20T00:00:00Z' }),
      model({ id: 'free', unitCostUsd: 0, releasedAt: '2026-09-20T00:00:00Z' }),
      model({ id: 'priced' })
    ], NOW);

    expect(new Set(list.map((r) => r.id))).toEqual(new Set(['priced']));
  });

  it('cheapest-good skips a cheap model below the quality floor', () => {
    const list = recommend('text', [
      model({ id: 'top', benchmark: 60, unitCostUsd: 10 }),
      model({ id: 'good-cheap', benchmark: 52, unitCostUsd: 1 }),
      model({ id: 'junk', benchmark: 10, releasedAt: '2024-06-01T00:00:00Z', unitCostUsd: 0.05 })
    ], NOW);

    expect(tier(list, 'best')).toBe('top');
    expect(tier(list, 'cheapest-good')).toBe('good-cheap');
  });

  it('balanced trades a little quality for a much lower price', () => {
    const list = recommend('text', [
      model({ id: 'top', benchmark: 60, unitCostUsd: 30 }),
      model({ id: 'near', benchmark: 57, unitCostUsd: 3 }),
      model({ id: 'cheap', benchmark: 45, unitCostUsd: 0.4 })
    ], NOW);

    expect(tier(list, 'balanced')).toBe('near');
  });

  it('a new model without a benchmark counts as middling, not as the leader', () => {
    const list = recommend('text', [
      model({ id: 'leader', benchmark: 60, unitCostUsd: 10 }),
      model({ id: 'middle', benchmark: 40, unitCostUsd: 2 }),
      model({ id: 'low', benchmark: 20, unitCostUsd: 1 }),
      model({ id: 'unknown', benchmark: null, unitCostUsd: 0.5, releasedAt: '2026-09-20T00:00:00Z' })
    ], NOW);

    expect(tier(list, 'balanced')).not.toBe('unknown');
  });

  it('a model matching an exclusion row is never recommended', () => {
    const excluded = RECOMMENDATION_EXCLUSIONS.find((row) => row.medium === 'video');
    expect(excluded?.reason).toBeTruthy();

    const list = recommend('video', [
      model({ id: 'black-forest-labs/flux-video-upscale', releasedAt: '2026-09-20T00:00:00Z' }),
      model({ id: 'maker/generator' })
    ], NOW);

    expect(new Set(list.map((r) => r.id))).toEqual(new Set(['maker/generator']));
  });

  it('says why in one line: price and release month', () => {
    const [first] = recommend('video', [model({ id: 'v', unitCostUsd: 0.1 })], NOW);

    expect(first.why).toBe('$0.100/second · released 2026-08');
  });

  it('an empty catalogue recommends nothing', () => {
    expect(recommend('image', [], NOW)).toEqual([]);
  });
});

describe('modelAdvice', () => {
  const catalogue = [
    model({ id: 'current', releasedAt: '2026-09-01T00:00:00Z' }),
    model({ id: 'ancient', releasedAt: '2024-05-01T00:00:00Z' })
  ];

  it('warns about a model older than the horizon and names the balanced one', () => {
    const advice = modelAdvice('image', 'ancient', catalogue, NOW);

    expect(advice).toContain('ancient');
    expect(advice).toContain('current');
  });

  it('stays silent on a recommended model', () => {
    expect(modelAdvice('image', 'current', catalogue, NOW)).toBeNull();
  });

  it('stays silent on a model it knows nothing about', () => {
    expect(modelAdvice('image', 'unknown', catalogue, NOW)).toBeNull();
  });
});

describe('withRecommendations', () => {
  const choices = [
    { id: 'nano-banana-2', label: 'Nano Banana 2', wireId: 'google/gemini-3.1-flash-image' },
    { id: 'old-spec', label: 'Old', wireId: 'maker/old-image' }
  ];
  const rows = [
    model({ id: 'google/gemini-3.1-flash-image', releasedAt: '2026-09-01T00:00:00Z' }),
    model({ id: 'maker/old-image', releasedAt: '2024-09-01T00:00:00Z' }),
    model({ id: 'maker/not-offered', releasedAt: '2026-09-25T00:00:00Z' })
  ];

  it('tags the offered choice by its wire id and names it by the choice id', () => {
    const out = withRecommendations('image', choices, rows, NOW);

    expect(out.choices[0].tiers).toEqual(['best', 'balanced', 'cheapest-good']);
    expect(out.choices[0].recommendedWhy).toBe('$0.040/image · released 2026-09');
    expect(out.choices[1].tiers).toBeUndefined();
    expect(out.recommended.map((r) => r.id)).toEqual(['nano-banana-2', 'nano-banana-2', 'nano-banana-2']);
  });

  it('never recommends a synced model the canvas does not offer', () => {
    const out = withRecommendations('image', choices, rows, NOW);

    expect(out.candidates.map((c) => c.id)).not.toContain('maker/not-offered');
  });
});
