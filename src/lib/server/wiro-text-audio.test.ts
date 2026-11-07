import { describe, expect, it, vi } from 'vitest';
import fixture from './wiro-text-audio.fixture.json';
import { fetchWiroCatalogue, wiroModelRow, wiroTokenRates } from './wiro-catalogue';

const SYNCED = '2026-11-07T00:00:00.000Z';
const tool = (project: string) => fixture.tool.find((t) => t.cleanslugproject === project)!;

describe('Wiro LLMs become chat rows', () => {
  it('maps a curated LLM to a text-only chat row priced per million tokens', () => {
    const row = wiroModelRow(tool('gpt-5-nano'), SYNCED)!;

    expect(row).toMatchObject({
      id: 'wiro/openai/gpt-5-nano',
      catalogue: 'chat',
      provider: 'wiro',
      input_modalities: ['text'],
      output_modalities: ['text'],
      pricing: { usdPerMillionIn: 0.05, usdPerMillionOut: 0.4 },
      wire_spec: { owner: 'openai', project: 'gpt-5-nano', fields: { prompt: 'prompt', images: [] } }
    });
  });

  it.each([
    ['1 million input token $0.05, 1 million output token $0.40', 0.05, 0.4],
    ['$0.50 (text / image / video) for 1m input tokens, $1.00 (audio) for 1m input tokens. $3.0 for 1m output tokens', 0.5, 3],
    ['Off-peak: $0.15 input, $0.60 output, $0.003 cached input.', 0.15, 0.6],
    ['Input: $0.20 / Cached input: $0.05 / Output: $0.50 (reasoning)', 0.2, 0.5],
    ['Pricing per 1M tokens: $2 input (text/image/pdf), $10 output.', 2, 10],
    ['Pricing is token-based: input $1 per 1M tokens, output $5 per 1M tokens.', 1, 5]
  ])('reads token rates from "%s"', (note, input, output) => {
    expect(wiroTokenRates(note)).toEqual({ usdPerMillionIn: input, usdPerMillionOut: output });
  });

  it('drops an LLM whose price note says nothing readable', () => {
    expect(wiroTokenRates('Will be calculated when the task finishes.')).toBeNull();
  });

  it('ignores an LLM outside the curated list', () => {
    expect(wiroModelRow(tool('qwen3-32b'), SYNCED)).toBeNull();
  });
});

describe('Wiro speech and music become audio rows', () => {
  it('maps a TTS model priced per character, with its required voice fixed', () => {
    const row = wiroModelRow(tool('eleven-v4-turbo'), SYNCED)!;

    expect(row).toMatchObject({
      id: 'wiro/elevenlabs/eleven-v4-turbo',
      catalogue: 'audio',
      input_modalities: ['text'],
      output_modalities: ['audio'],
      pricing: { lines: [{ inputs: {}, usd: 0.00004, method: 'cp-promptlength' }] },
      wire_spec: { fields: { prompt: 'prompt', images: [] }, fixed: { voice: 'alice', outputFormat: 'mp3_44100_128' } }
    });
  });

  it('maps a music model priced per run and duration', () => {
    const row = wiroModelRow(tool('text-to-music-v2'), SYNCED)!;

    expect(row.catalogue).toBe('audio');
    expect(row.wire_spec.fields).toMatchObject({ prompt: 'prompt', duration: 'duration', images: [] });
    expect((row.pricing as { lines: unknown[] }).lines).toContainEqual({ inputs: { duration: '10' }, usd: 0.025, method: 'cpr' });
  });

  it('keeps an optional reference image off an audio row', () => {
    expect(wiroModelRow(tool('lyria-3'), SYNCED)!.wire_spec.fields.images).toEqual([]);
  });
});

describe('the Wiro sync reads the LLM and audio categories', () => {
  it('asks for them and lands the curated rows', async () => {
    const fetchFn = vi.fn(async () => Response.json(fixture));
    const out = await fetchWiroCatalogue(fetchFn as unknown as typeof fetch, 'https://wiro.test/v1', SYNCED);

    const bodies = fetchFn.mock.calls.map((call) => JSON.parse(String((call as unknown as [string, RequestInit])[1].body)));
    expect(bodies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ categories: ['partner-llm'] }),
        expect.objectContaining({ categories: ['text-to-speech'] }),
        expect.objectContaining({ categories: ['music-generation'] })
      ])
    );
    const catalogueOf = new Map(out.rows.map((r) => [r.id, r.catalogue]));
    expect(catalogueOf.get('wiro/claude/sonnet-5')).toBe('chat');
    expect(catalogueOf.get('wiro/google/lyria-3')).toBe('audio');
  });
});
