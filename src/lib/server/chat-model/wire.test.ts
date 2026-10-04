import { describe, it, expect } from 'vitest';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { reasoningProviderOptions } from './catalogue';

async function sentBody(reasoning: string | null): Promise<Record<string, unknown>> {
  let body = '';
  const provider = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: 'k',
    fetch: async (_url, init) => {
      body = String(init?.body ?? '');
      return new Response('{}', { status: 400 });
    }
  });
  const result = streamText({ model: provider('anthropic/claude-sonnet-5.5'), prompt: 'hi', maxRetries: 0, onError: () => {}, providerOptions: reasoningProviderOptions(reasoning) });
  await result.consumeStream({ onError: () => {} });
  return JSON.parse(body) as Record<string, unknown>;
}

describe('reasoning on the wire to OpenRouter', () => {
  it('a chosen effort is sent as reasoning.effort, even on a non-OpenAI model', async () => {
    expect(await sentBody('low')).toMatchObject({ model: 'anthropic/claude-sonnet-5.5', reasoning: { effort: 'low' } });
  });

  it('no choice sends no reasoning field', async () => {
    expect(await sentBody(null)).not.toHaveProperty('reasoning');
  });
});
