import { describe, expect, it, vi } from 'vitest';
import { jev, jevUsd } from './jev';
import { IDENTIFIABILITY_CATEGORIES, MODERATION_CATEGORIES } from './policy';

function recorder(reply: () => Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return reply();
  });
  return { calls, model: jev({ apiKey: 'k', baseUrl: 'https://jev.test/v1', fetchFn: fetchFn as typeof fetch }) };
}

const answer = {
  model: 'jev-1.13.0',
  answers: { category: { type: 'choice', choice: 'safe', probabilities: { safe: 0.99, hate: 0.01 }, confidence: 0.97 } },
  usage: { input_tokens: 300, output_tokens: 20 }
};

describe('Jev adapter', () => {
  it('asks one choice question over every moderation category, bearer-authenticated', async () => {
    const { calls, model } = recorder(() => Response.json(answer));
    const out = await model.decide('Prompt: a lake');

    expect(calls[0].url).toBe('https://jev.test/v1/systemone');
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe('Bearer k');
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.model).toBe('jev-latest');
    expect(body.state).toBe('Prompt: a lake');
    expect(Object.keys(body.questions.category.criteria)).toEqual(Object.keys(MODERATION_CATEGORIES));
    expect(out).toEqual({ choice: 'safe', probabilities: { safe: 0.99, hate: 0.01 }, tokens: 320 });
  });

  it('throws on a non-2xx so the screen fails closed', async () => {
    const { model } = recorder(() => new Response('overloaded', { status: 529 }));
    await expect(model.decide('x')).rejects.toThrow(/529/);
  });

  it('prices tokens at the published rate', () => {
    expect(jevUsd(1_000_000)).toBeCloseTo(0.042);
  });
});

describe('Jev adapter against a custom category table', () => {
  it('sends the identifiability criteria keys when configured with that table', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return Response.json(answer);
    });
    const model = jev({ apiKey: 'k', baseUrl: 'https://jev.test/v1', fetchFn: fetchFn as typeof fetch, categories: IDENTIFIABILITY_CATEGORIES });
    await model.decide('x');
    const body = JSON.parse(String(calls[0].init.body));
    expect(Object.keys(body.questions.category.criteria)).toEqual(Object.keys(IDENTIFIABILITY_CATEGORIES));
  });
});
