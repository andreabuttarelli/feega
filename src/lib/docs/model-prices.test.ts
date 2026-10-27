import { describe, expect, it } from 'vitest';
import { creditsText, entriesFromKie, entriesFromRows, renderPriceTable, type SnapshotRow } from './model-prices';

const row = (over: Partial<SnapshotRow>): SnapshotRow => ({ id: 'x/y', catalogue: 'image', provider: 'openrouter', label: null, pricing: {}, ...over });

describe('creditsText', () => {
  it('charges 120 credits per provider dollar', () => {
    expect(creditsText(1)).toBe('120');
    expect(creditsText(0.045)).toBe('5.4');
  });

  it('keeps tiny prices readable', () => {
    expect(creditsText(0.0001)).toBe('0.012');
  });
});

describe('entriesFromRows', () => {
  it('prices chat per million tokens, input and output apart', () => {
    const entries = entriesFromRows([row({ id: 'a/chat', catalogue: 'chat', pricing: { prompt: '0.000001', completion: '0.000005' } })]);
    expect(entries.map((e) => [e.unit, e.usdLow])).toEqual([
      ['per 1M input tokens', 1],
      ['per 1M output tokens', 5]
    ]);
  });

  it('spans the variants of an image', () => {
    const pricing = { endpoints: [{ lines: [{ unit: 'image', billable: 'output_image', cost_usd: 0.04, variant: '1k' }, { unit: 'image', billable: 'output_image', cost_usd: 0.08, variant: '2k' }] }] };
    const [entry] = entriesFromRows([row({ pricing })]);
    expect([entry.unit, entry.usdLow, entry.usdHigh]).toEqual(['per image', 0.04, 0.08]);
    expect(entry.notes).toContain('1k');
  });

  it('reads openrouter video seconds in cents and tokens per million', () => {
    const entries = entriesFromRows([
      row({ catalogue: 'video', id: 'v/a', pricing: { cents_per_video_output_second_480p: '8', cents_per_video_output_second_720p: '14' } }),
      row({ catalogue: 'video', id: 'v/b', pricing: { video_tokens: '0.0000107' } })
    ]);
    expect(entries.map((e) => [e.unit, e.usdLow, e.usdHigh])).toEqual([
      ['per second', 0.08, 0.14],
      ['per 1M video tokens', 10.7, null]
    ]);
  });

  it('turns a wiro run with a duration into a per second price', () => {
    const lines = [
      { usd: 1, inputs: { duration: '5', resolution: '720p' }, method: 'cpr' },
      { usd: 3, inputs: { duration: '10', resolution: '1080p' }, method: 'cpr' }
    ];
    const [entry] = entriesFromRows([row({ id: 'wiro/k/v', catalogue: 'video', provider: 'wiro', pricing: { lines } })]);
    expect([entry.unit, entry.usdLow, entry.usdHigh]).toEqual(['per second', 0.2, 0.3]);
    expect(entry.notes).toContain('resolution: 720p, 1080p');
  });

  it('flags a metered wiro model as unpriced', () => {
    const [entry] = entriesFromRows([row({ id: 'wiro/k/m', provider: 'wiro', pricing: { lines: [{ usd: 0, inputs: {}, method: 'cp-readoutput' }] } })]);
    expect(entry.usdLow).toBeNull();
    expect(entry.notes).toContain('metered');
  });
});

describe('entriesFromKie', () => {
  it('converts kie credits to dollars at half a cent', () => {
    const [entry] = entriesFromKie([{ modelDescription: 'seedance, 720p', interfaceType: 'video', creditPrice: '14', creditUnit: 'per second' }]);
    expect([entry.model, entry.kind, entry.unit, entry.usdLow]).toEqual(['seedance, 720p', 'video', 'per second', 0.07]);
  });
});

describe('renderPriceTable', () => {
  it('escapes pipes and prints credits', () => {
    const table = renderPriceTable([{ model: 'a|b', provider: 'Wiro', kind: 'image', unit: 'per image', usdLow: 0.05, usdHigh: null, notes: '' }]);
    expect(table).toContain('a\\|b');
    expect(table).toContain('| 6 |');
  });

  it('escapes characters that break mdx', () => {
    const table = renderPriceTable([{ model: 'a<b>{c}', provider: 'Wiro', kind: 'image', unit: 'per image', usdLow: 0.05, usdHigh: null, notes: '' }]);
    expect(table).not.toMatch(/[<>{}]/);
  });

  it('writes a dash for a model without a static price', () => {
    const table = renderPriceTable([{ model: 'm', provider: 'Wiro', kind: 'video', unit: 'per run', usdLow: null, usdHigh: null, notes: 'metered' }]);
    expect(table).toContain('| not published |');
  });
});
