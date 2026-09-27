import { describe, expect, it } from 'vitest';
import { estimateCanvasTextCost } from './text-cost-estimate';

describe('estimateCanvasTextCost', () => {
  it('conta il prompt composto con tutti i testi collegati', async () => {
    const result = await estimateCanvasTextCost({
      material: ['a'.repeat(400), 'b'.repeat(400)],
      ownPrompt: 'c'.repeat(400),
      inputCost: 'fixed',
      decide: null
    });

    expect(result.userPromptTokens).toBeGreaterThan(300);
    expect(result.estimatedOutputTokens).toBe(result.userPromptTokens);
    expect(result.variableInput).toBe(false);
  });

  it('dichiara variabile un input immagine, video o audio', async () => {
    const result = await estimateCanvasTextCost({
      material: [],
      ownPrompt: 'descrivi',
      inputCost: 'variable_media',
      decide: null
    });

    expect(result.variableInput).toBe(true);
  });
});
