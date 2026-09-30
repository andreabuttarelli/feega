import { describe, expect, it, vi } from 'vitest';

const M = vi.hoisted(() => ({ calls: [] as Array<Record<string, unknown>> }));

vi.mock('$lib/server/llm', () => ({
  llmGeminiSearchModel: () => 'google/gemini-search',
  llmImagesFromInline: () => [],
  llmStructured: async () => ({}),
  llmText: async (args: Record<string, unknown>) => {
    M.calls.push(args);
    return { text: 'answer', citations: [{ uri: 'https://a.dev', title: 'A' }] };
  }
}));
vi.mock('$lib/server/ai-log', () => ({ requireBrandContext: () => 'brand-1', logAiCall: () => {} }));

const { groundedText } = await import('./research');

describe('groundedText', () => {
  it('searches the web through the gateway and returns its citations', async () => {
    const res = await groundedText('who competes?', 'be precise');

    expect(M.calls).toEqual([
      expect.objectContaining({ prompt: 'who competes?', system: 'be precise', webSearch: 'native', model: 'google/gemini-search' })
    ]);
    expect(res).toEqual({ text: 'answer', citations: [{ uri: 'https://a.dev', title: 'A' }] });
  });
});
