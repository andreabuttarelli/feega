import { describe, it, expect } from 'vitest';
import { candidateOf, syncedCandidates, type ReleaseRow } from './recommended-models';

function row(over: Partial<ReleaseRow>): ReleaseRow {
  return {
    id: 'maker/model',
    label: 'Model',
    released_at: '2026-08-01T00:00:00Z',
    expires_at: null,
    context_length: null,
    intelligence_index: null,
    supported_resolutions: [],
    param_schema: {},
    pricing: {},
    ...over
  };
}

describe('syncedCandidates — never recommends an uncensored model', () => {
  it('drops uncensored rows before scoring', async () => {
    const rows = [row({ id: 'a/safe' }), { ...row({ id: 'wiro/x/uncensored' }), uncensored: true }];
    const admin = { from: () => ({ select: () => ({ eq: async () => ({ data: rows, error: null }) }) }) };

    const out = await syncedCandidates(admin as never, 'image');

    expect(out.map((c) => c.id)).toEqual(['a/safe']);
  });

  it('prices a Wiro image by its cheapest per-run line', () => {
    const c = candidateOf('image', row({ pricing: { lines: [{ inputs: {}, usd: 0.02, method: 'cpr' }, { inputs: {}, usd: 0.05, method: 'cpr' }] } }));
    expect(c.unitCostUsd).toBeCloseTo(0.02);
  });
});

describe('candidateOf — what one catalogue row is worth recommending', () => {
  it('text costs per million output tokens and brings its benchmark and context', () => {
    const c = candidateOf('text', row({ pricing: { completion: '0.00001' }, intelligence_index: 56, context_length: 200000 }));

    expect(c.unitCostUsd).toBeCloseTo(10);
    expect(c.benchmark).toBe(56);
    expect(c.capability).toBe(200000);
  });

  it('an image billed per image costs its cheapest plain line', () => {
    const pricing = {
      endpoints: [{ lines: [
        { billable: 'output_image', unit: 'image', cost_usd: 0.045 },
        { billable: 'output_image', unit: 'image', variant: 'high_resolution', cost_usd: 0.09 },
        { billable: 'input_image', unit: 'image', cost_usd: 0.003 }
      ], parameters: {} }]
    };

    expect(candidateOf('image', row({ pricing })).unitCostUsd).toBeCloseTo(0.045);
  });

  it('an image billed per token costs one 1K image worth of tokens', () => {
    const pricing = { endpoints: [{ lines: [{ billable: 'output_image', unit: 'token', cost_usd: 0.00006 }], parameters: {} }] };

    expect(candidateOf('image', row({ pricing })).unitCostUsd).toBeCloseTo(0.0774);
  });

  it('an image with no price lines has no known cost', () => {
    expect(candidateOf('image', row({ pricing: { endpoints: [{ lines: [], parameters: {} }] } })).unitCostUsd).toBeNull();
  });

  it('a video costs its cheapest price per second, whatever unit the provider bills in', () => {
    expect(candidateOf('video', row({ pricing: { duration_seconds_720p: '0.0988', duration_seconds_1080p: '0.17' } })).unitCostUsd).toBeCloseTo(0.0988);
    expect(candidateOf('video', row({ pricing: { cents_per_second_output: '12' } })).unitCostUsd).toBeCloseTo(0.12);
    expect(candidateOf('video', row({ pricing: { cents_per_video_output_second_480p: '5' } })).unitCostUsd).toBeCloseTo(0.05);
    expect(candidateOf('video', row({ pricing: { video_tokens: '0.0000042' } })).unitCostUsd).toBeCloseTo(0.0907, 3);
  });

  it('a video price that needs a source clip does not count as its price', () => {
    const pricing = { video_tokens: '0.000007', video_tokens_with_video_input: '0.0000043' };

    expect(candidateOf('video', row({ pricing })).unitCostUsd).toBeCloseTo(0.1512);
  });

  it('image and video capability counts declared resolutions and parameters', () => {
    const c = candidateOf('image', row({ supported_resolutions: ['1K', '2K', '4K'], param_schema: { seed: {}, n: {} } }));

    expect(c.capability).toBe(5);
  });
});
