import { describe, it, expect, vi, beforeEach } from 'vitest';

const resolveOrgCaller = vi.fn();
const loadMedia = vi.fn();

vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: (...a: unknown[]) => resolveOrgCaller(...a) }));
vi.mock('$lib/server/canvas/node-media', () => ({ loadMedia: (...a: unknown[]) => loadMedia(...a) }));
vi.mock('$lib/server/canvas/sign-media', () => ({ createAssetSigningDb: () => ({ service: true }) }));

import { GET } from './+server';

function call(qs: string) {
  const url = new URL(`https://feega.test/api/v1/org/media?${qs}`);
  return (GET as (event: unknown) => Promise<Response>)({
    request: new Request(url, { headers: { authorization: 'Bearer token' } }),
    url
  }).then(async (res) => ({ res, body: await res.json() }));
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveOrgCaller.mockResolvedValue({ caller: { db: { user: true }, orgId: 'org-1', userId: 'u', writeAllowed: false } });
});

describe('GET /api/v1/org/media', () => {
  it('rejects an unauthenticated caller', async () => {
    resolveOrgCaller.mockResolvedValue({ error: { status: 401, body: { error: 'invalid_token' } } });

    const { res } = await call('asset=a');

    expect(res.status).toBe(401);
    expect(loadMedia).not.toHaveBeenCalled();
  });

  it('reads with the caller db scoped to its org, even with a read-only key', async () => {
    loadMedia.mockResolvedValue({ items: [{ assetId: 'a', fullUrl: 'https://signed' }], missing: [] });

    const { res, body } = await call('node=n1,n2&asset=a&run=r1');

    expect(res.status).toBe(200);
    expect(loadMedia).toHaveBeenCalledWith({ user: true }, { service: true },
      { orgId: 'org-1', nodeIds: ['n1', 'n2'], assetIds: ['a'], runIds: ['r1'] });
    expect(body.items[0].fullUrl).toBe('https://signed');
  });

  it('answers 404 when nothing asked for is visible to the org', async () => {
    loadMedia.mockResolvedValue({ items: [], missing: ['other-org-asset'] });

    const { res, body } = await call('asset=other-org-asset');

    expect(res.status).toBe(404);
    expect(body.missing).toEqual(['other-org-asset']);
  });

  it('refuses a request that names nothing', async () => {
    const { res } = await call('');

    expect(res.status).toBe(400);
  });
});
