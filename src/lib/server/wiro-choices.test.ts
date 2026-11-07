import { describe, expect, it } from 'vitest';
import fixture from './wiro-text-audio.fixture.json';
import { wiroModelRow } from './wiro-catalogue';
import { wiroAudioChoice, wiroTextChoice } from './wiro-choices';
import { creditsForRun } from '$lib/canvas/gen-cost';
import { CREDITS_PER_USD_SUBSCRIPTION_LIST } from '$lib/credit-ladder';

const row = (project: string) => wiroModelRow(fixture.tool.find((t) => t.cleanslugproject === project)!, '2026-11-07T00:00:00.000Z')!;

describe('a Wiro chat row in the text menu', () => {
  it('sits under Wiro with its per-million rates in credits', () => {
    expect(wiroTextChoice(row('gpt-5-nano'))).toMatchObject({
      id: 'wiro/openai/gpt-5-nano',
      provider: 'wiro',
      providerLabel: 'Wiro',
      inputModalities: ['text'],
      textPricing: { inputCreditsPerMillion: 0.05 * CREDITS_PER_USD_SUBSCRIPTION_LIST, outputCreditsPerMillion: 0.4 * CREDITS_PER_USD_SUBSCRIPTION_LIST }
    });
  });

  it('is not offered without a price', () => {
    expect(wiroTextChoice({ ...row('gpt-5-nano'), pricing: {} })).toBeNull();
  });
});

describe('a Wiro audio row in the audio menu', () => {
  it('prices a TTS run by the characters it voices', () => {
    const choice = wiroAudioChoice(row('eleven-v4-turbo'))!;

    expect(choice).toMatchObject({ provider: 'wiro', providerLabel: 'Wiro', inputModalities: ['text'] });
    expect(creditsForRun({ medium: 'audio', model: choice, params: {}, prompt: 'x'.repeat(1000) })).toBe(Math.ceil(1000 * 0.00004 * CREDITS_PER_USD_SUBSCRIPTION_LIST));
  });

  it('prices a music run by its duration line', () => {
    const choice = wiroAudioChoice(row('text-to-music-v2'))!;

    expect(choice.durationOptions).toContain(10);
    expect(creditsForRun({ medium: 'audio', model: choice, params: { duration: 10 }, prompt: 'lofi' })).toBeGreaterThan(0);
  });

  it('is not offered without a price', () => {
    expect(wiroAudioChoice({ ...row('lyria-3'), pricing: { lines: [] } })).toBeNull();
  });
});
