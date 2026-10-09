import { describe, expect, it, vi } from 'vitest';

const M = vi.hoisted(() => ({ logAiCall: vi.fn(), port: vi.fn() }));
vi.mock('$env/static/public', () => ({ PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }));
vi.mock('$env/dynamic/private', () => ({ env: { EXA_API_KEY: 'k' } }));
vi.mock('$lib/server/ai-log', () => ({ logAiCall: M.logAiCall }));
vi.mock('./search', async (importOriginal) => ({ ...(await importOriginal<typeof import('./search')>()), exaSearch: () => M.port }));

import { loggedSearch } from './live';
import { SearchEngine } from './search';

const SCOPE = { orgId: 'org-1', userId: 'u-1', projectId: 'p-1', brandId: null };

describe('web search billing', () => {
  it('logs every search in ai_calls with the provider cost, on the org and project', async () => {
    M.port.mockResolvedValueOnce({ ok: true, results: [], costUsd: 0.007 });

    await loggedSearch(SCOPE, SearchEngine.Exa)('stripe colours', 5);

    expect(M.logAiCall).toHaveBeenCalledWith(expect.objectContaining({ label: 'web-search', provider: 'exa', ok: true, flatCostUsd: 0.007, orgId: 'org-1', projectId: 'p-1', userId: 'u-1', actorKind: 'agent' }));
  });

  it('logs a failed search without a cost', async () => {
    M.logAiCall.mockClear();
    M.port.mockResolvedValueOnce({ ok: false, error: 'web search failed: down' });

    await loggedSearch(SCOPE, SearchEngine.Exa)('q', 5);

    const entry = M.logAiCall.mock.calls[0][0];
    expect(entry).toMatchObject({ ok: false, error: 'web search failed: down' });
    expect(entry.flatCostUsd).toBeUndefined();
  });
});
