import { describe, it, expect, vi, beforeEach } from 'vitest';

const resolveOrgCaller = vi.fn();
const makeEffectsPair = vi.fn();

vi.mock('$lib/server/org-data/auth', () => ({
  resolveOrgCaller: (...args: unknown[]) => resolveOrgCaller(...args)
}));
vi.mock('$lib/server/canvas/effects-actions', () => ({
  makeEffectsPair: (...args: unknown[]) => makeEffectsPair(...args)
}));

import { POST } from './+server';

function call() {
  const url = new URL('https://feega.test/api/v1/org/nodes/fx-1/effects-pair');
  return (POST as (event: unknown) => Promise<Response>)({
    request: new Request(url, { method: 'POST', headers: { authorization: 'Bearer token' } }),
    params: { id: 'fx-1' },
    url
  }).then(async (res) => ({ res, body: await res.json() }));
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveOrgCaller.mockResolvedValue({ caller: { db: {}, orgId: 'org-1', userId: 'user-1', writeAllowed: true } });
});

describe('POST /api/v1/org/nodes/:id/effects-pair', () => {
  it('returns the twin node and its asset', async () => {
    makeEffectsPair.mockResolvedValue({ outcome: 'applied', nodeId: 'fx-2', assetId: 'asset-b' });

    const { res, body } = await call();

    expect(makeEffectsPair).toHaveBeenCalledWith({}, expect.objectContaining({ orgId: 'org-1', nodeId: 'fx-1' }));
    expect(res.status).toBe(200);
    expect(body).toEqual({ node_id: 'fx-2', asset_id: 'asset-b' });
  });

  it('maps refused to 400', async () => {
    makeEffectsPair.mockResolvedValue({ outcome: 'refused', error: 'no_shape_cutout' });

    const { res } = await call();

    expect(res.status).toBe(400);
  });

  it('rejects a read-only key', async () => {
    resolveOrgCaller.mockResolvedValue({ caller: { db: {}, orgId: 'org-1', userId: 'user-1', writeAllowed: false } });

    const { res } = await call();

    expect(res.status).toBe(403);
    expect(makeEffectsPair).not.toHaveBeenCalled();
  });
});
