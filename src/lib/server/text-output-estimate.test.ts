import { describe, expect, it, vi } from 'vitest';
import type { Decide } from '$lib/canvas/decide';
import { estimateTextOutput } from './text-output-estimate';

describe('estimateTextOutput', () => {
  it('Jev sceglie la fascia di output usando i conteggi system e user', async () => {
    const decide: Decide = vi.fn(async (_question, state) => {
      expect(state).toMatchObject({ systemTokens: 100, userTokens: 900 });
      return { kind: 'score' as const, value: 3, confidence: 0.8 };
    });

    const output = await estimateTextOutput({
      systemPrompt: 's'.repeat(400),
      userPrompt: 'u'.repeat(3600),
      decide
    });

    expect(output).toBe(2000);
  });

  it('senza Jev usa una stima deterministica basata sulla somma degli input', async () => {
    const output = await estimateTextOutput({
      systemPrompt: 's'.repeat(400),
      userPrompt: 'u'.repeat(3600),
      decide: null
    });

    expect(output).toBe(1000);
  });
});
