import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateText } from 'ai';
import { PromptCache } from './prompt-cache';

const M = vi.hoisted(() => ({
  env: {} as Record<string, string | undefined>,
  fetch: vi.fn()
}));

vi.mock('$env/dynamic/private', () => ({ env: M.env }));
vi.mock('$lib/server/ai-log', () => ({ logAiCall: vi.fn(), extractSdkUsage: () => ({}), noteLlmCost: vi.fn() }));

const COMPLETED = {
  id: 'r',
  created_at: 0,
  model: 'anthropic/claude-opus-5.5',
  output: [{ type: 'message', id: 'm', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: 'ok', annotations: [] }] }],
  usage: { input_tokens: 1, output_tokens: 1 }
};

function sentBody(): Record<string, unknown> {
  const call = M.fetch.mock.calls.find((c) => typeof (c[1] as RequestInit | undefined)?.body === 'string')!;
  return JSON.parse((call[1] as RequestInit).body as string);
}

describe('a cached model asks the gateway for a cache breakpoint on the wire', () => {
  beforeEach(() => {
    vi.resetModules();
    M.fetch.mockReset();
    Object.assign(M.env, { LLM_API_KEY: 'k', LLM_DEFAULT_MODEL: 'anthropic/claude-opus-5.5' });
    M.fetch.mockImplementation(async () => new Response(JSON.stringify(COMPLETED), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', M.fetch);
  });

  it('with the cache on, the request carries cache_control', async () => {
    const { llmLanguageModel } = await import('./llm');
    await generateText({ model: llmLanguageModel('anthropic/claude-opus-5.5', PromptCache.On), system: 'rules', prompt: 'hi' });

    expect(sentBody().cache_control).toEqual({ type: 'ephemeral' });
  });

  it('by default it does not', async () => {
    const { llmLanguageModel } = await import('./llm');
    await generateText({ model: llmLanguageModel('anthropic/claude-opus-5.5'), system: 'rules', prompt: 'hi' });

    expect(sentBody().cache_control).toBeUndefined();
  });
});
