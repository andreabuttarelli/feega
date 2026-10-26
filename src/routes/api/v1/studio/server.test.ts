import { describe, expect, it, vi } from 'vitest';

const callers: Record<string, unknown> = {
  jwt: { db: {}, orgId: 'org', userId: 'u', writeAllowed: true },
  feega_key: { db: {}, orgId: 'org', userId: 'u', apiKeyId: 'k', writeAllowed: true },
  feega_readonly: { db: {}, orgId: 'org', userId: 'u', apiKeyId: 'k', writeAllowed: false }
};
vi.mock('$lib/server/org-data/auth', () => ({
  resolveOrgCaller: async (token: string) => (callers[token] ? { caller: callers[token] } : { error: { status: 401, body: { error: 'invalid_token' } } })
}));
vi.mock('$lib/server/repos/projects', () => ({ listProjects: async () => [{ id: 'proj', mode: 'standard' }] }));
vi.mock('$lib/server/studio/studio-options', () => ({ studioOptions: async () => ({}) }));

const quoteSelection = vi.fn();
const startBatch = vi.fn(async () => ({ batchId: 'b1' }));
vi.mock('$lib/server/studio/studio-batch', async (original) => ({ ...(await original<object>()), quoteSelection, startBatch }));
const denied = vi.fn(async () => undefined as unknown);
vi.mock('$lib/server/cli-auth', async (original) => ({ ...(await original<object>()), gateOrgAiActionForForm: denied }));

const selection = { name: 'Mugs', productIds: ['p'], modelIds: [], environments: ['white_ecom'], shots: ['packshot'], variations: 1, model: 'm', styleRefs: [], noPeopleConfirmed: false };
const priced = (perImage: number) => ({ plan: { items: [{}, {}], overLimit: false, skipped: [] }, model: { credits: perImage }, droppedRefs: 0 });

const quoteRoute = await import('./quote/+server');
const startRoute = await import('./start/+server');

function call(handler: (event: never) => Response | Promise<Response>, path: string, body: unknown, token = 'jwt') {
  const url = new URL(`https://feega.test/api/v1/studio/${path}`);
  const request = new Request(url, { method: 'POST', body: JSON.stringify(body), headers: { authorization: `Bearer ${token}` } });
  return handler({ request, url, params: {} } as never);
}

describe('a photo studio batch started over bearer', () => {
  it('quotes the count and the credits with an id', async () => {
    quoteSelection.mockReturnValue(priced(4));

    const res = await call(quoteRoute.POST, 'quote', { selection });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ count: 2, total: 8, quoteId: expect.any(String) });
  });

  it('starts only with the id of a quote it just gave', async () => {
    quoteSelection.mockReturnValue(priced(4));
    const { quoteId } = await (await call(quoteRoute.POST, 'quote', { selection })).json();

    const started = await call(startRoute.POST, 'start', { selection, quoteId });

    expect(started.status).toBe(200);
    expect(await started.json()).toEqual({ batchId: 'b1' });
  });

  it('refuses a start without a quote id', async () => {
    quoteSelection.mockReturnValue(priced(4));
    startBatch.mockClear();

    const res = await call(startRoute.POST, 'start', { selection });

    expect(res.status).toBe(400);
    expect(startBatch).not.toHaveBeenCalled();
  });

  it('refuses with 409 when the price moved since the quote', async () => {
    quoteSelection.mockReturnValue(priced(4));
    const { quoteId } = await (await call(quoteRoute.POST, 'quote', { selection })).json();
    quoteSelection.mockReturnValue(priced(6));
    startBatch.mockClear();

    const res = await call(startRoute.POST, 'start', { selection, quoteId });

    expect(res.status).toBe(409);
    expect(startBatch).not.toHaveBeenCalled();
  });

  it('stops at the credit gate before spending', async () => {
    quoteSelection.mockReturnValue(priced(4));
    const { quoteId } = await (await call(quoteRoute.POST, 'quote', { selection })).json();
    denied.mockResolvedValueOnce({ status: 402, data: { error: 'credits_exhausted', message: 'out' } });
    startBatch.mockClear();

    const res = await call(startRoute.POST, 'start', { selection, quoteId });

    expect(res.status).toBe(402);
    expect(startBatch).not.toHaveBeenCalled();
  });

  it('starts for an API key too, and refuses a read-only one', async () => {
    quoteSelection.mockReturnValue(priced(4));
    const { quoteId } = await (await call(quoteRoute.POST, 'quote', { selection }, 'feega_key')).json();
    startBatch.mockClear();

    expect((await call(startRoute.POST, 'start', { selection, quoteId }, 'feega_key')).status).toBe(200);
    expect((await call(startRoute.POST, 'start', { selection, quoteId }, 'feega_readonly')).status).toBe(403);
    expect(startBatch).toHaveBeenCalledTimes(1);
  });

  it('rejects a bad token', async () => {
    expect((await call(quoteRoute.POST, 'quote', { selection }, 'bad')).status).toBe(401);
  });
});
