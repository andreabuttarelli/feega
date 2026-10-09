import { describe, expect, it, vi } from 'vitest';

const M = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));
vi.mock('$env/dynamic/private', () => ({ env: M.env }));

import { SearchEngine, exaSearch, openRouterSearch, searchEngineOf } from './search';

const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe('web search', () => {
  it('maps Exa results to title, url, snippet and date, with the billed cost', async () => {
    const http = reply({
      costDollars: { total: 0.007 },
      results: [
        { title: 'Stripe colours', url: 'https://a.example/stripe', publishedDate: '2026-01-02T00:00:00.000Z', highlights: ['Primary #533AFD', 'Navy #0A2540'] },
        { title: null, url: 'https://b.example/', text: 'Body text only' }
      ]
    });

    const out = await exaSearch('key', http as never)('stripe brand colours', 2);

    expect(out).toEqual({
      ok: true,
      costUsd: 0.007,
      results: [
        { title: 'Stripe colours', url: 'https://a.example/stripe', snippet: 'Primary #533AFD … Navy #0A2540', date: '2026-01-02' },
        { title: 'https://b.example/', url: 'https://b.example/', snippet: 'Body text only', date: null }
      ]
    });
    const [, init] = http.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({ query: 'stripe brand colours', numResults: 2 });
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('key');
  });

  it('turns an Exa error into a refusal the model can read', async () => {
    const out = await exaSearch('key', reply({ error: 'bad key' }, 401) as never)('q', 3);

    expect(out).toEqual({ ok: false, error: 'web search failed: bad key' });
  });

  it('maps OpenRouter web plugin citations, deduplicated, with the gateway cost', async () => {
    const http = reply({
      usage: { cost: 0.021 },
      choices: [{ message: { content: 'x', annotations: [
        { type: 'url_citation', url_citation: { url: 'https://a.example/', title: 'A', content: 'snippet a' } },
        { type: 'url_citation', url_citation: { url: 'https://a.example/', title: 'A again' } },
        { type: 'url_citation', url_citation: { url: 'https://b.example/', title: '' } }
      ] } }]
    });

    const out = await openRouterSearch({ baseUrl: 'https://gw', apiKey: 'k', model: 'm' }, http as never)('q', 3);

    expect(out).toEqual({
      ok: true,
      costUsd: 0.021,
      results: [
        { title: 'A', url: 'https://a.example/', snippet: 'snippet a', date: null },
        { title: 'https://b.example/', url: 'https://b.example/', snippet: '', date: null }
      ]
    });
    const [, init] = http.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).plugins).toEqual([{ id: 'web', max_results: 3 }]);
  });

  it('prefers Exa when its key is set, the gateway otherwise', () => {
    expect(searchEngineOf({ EXA_API_KEY: 'k' })).toBe(SearchEngine.Exa);
    expect(searchEngineOf({ EXA_API_KEY: ' ' })).toBe(SearchEngine.Gateway);
    expect(searchEngineOf({})).toBe(SearchEngine.Gateway);
  });
});
