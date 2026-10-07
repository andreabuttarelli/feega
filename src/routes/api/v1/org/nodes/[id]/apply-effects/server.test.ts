import { describe, it, expect, vi, beforeEach } from 'vitest';

const resolveOrgCaller = vi.fn();
const applyEffectsTo = vi.fn();

vi.mock('$lib/server/org-data/auth', () => ({
  resolveOrgCaller: (...args: unknown[]) => resolveOrgCaller(...args)
}));
vi.mock('$lib/server/canvas/effects-actions', () => ({
  applyEffectsTo: (...args: unknown[]) => applyEffectsTo(...args)
}));

import { POST } from './+server';

const ORG = 'org-1';
const NODE = 'node-1';
const USER = 'user-1';

function call(id: string, body?: unknown) {
  const url = new URL(`https://feega.test/api/v1/org/nodes/${id}/apply-effects`);
  return (POST as (event: unknown) => Promise<Response>)({
    request: new Request(url, {
      method: 'POST',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    }),
    params: { id },
    url
  }).then(async (res) => ({ res, body: await res.json() }));
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveOrgCaller.mockResolvedValue({
    caller: { db: {}, orgId: ORG, userId: USER, writeAllowed: true, apiKeyId: 'key-1' }
  });
  applyEffectsTo.mockResolvedValue({ outcome: 'applied', nodeId: NODE, assetId: 'asset-out' });
});

describe('POST /api/v1/org/nodes/:id/apply-effects', () => {
  it('renders the stack already on the node when no body is sent', async () => {
    const { res, body } = await call(NODE);

    expect(applyEffectsTo).toHaveBeenCalledWith({}, expect.objectContaining({ orgId: ORG, nodeId: NODE, effects: undefined }));
    expect(res.status).toBe(200);
    expect(body).toEqual({ node_id: NODE, asset_id: 'asset-out' });
  });

  it('passes a chain of effects through', async () => {
    const effects = [{ id: 'posterize', params: { levels: 3 } }];

    await call(NODE, { effects });

    expect(applyEffectsTo).toHaveBeenCalledWith({}, expect.objectContaining({ effects }));
  });

  it('maps refused to 400', async () => {
    applyEffectsTo.mockResolvedValue({ outcome: 'refused', error: 'sourceRefId mancante' });

    const { res, body } = await call(NODE);

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/sourceRefId/);
  });

  it('maps conflict to 409', async () => {
    applyEffectsTo.mockResolvedValue({ outcome: 'conflict' });

    const { res, body } = await call(NODE);

    expect(res.status).toBe(409);
    expect(body.conflict).toBe(true);
  });

  it('rejects a write when the API key is read-only', async () => {
    resolveOrgCaller.mockResolvedValue({
      caller: { db: {}, orgId: ORG, userId: USER, writeAllowed: false, apiKeyId: 'key-1' }
    });

    const { res, body } = await call(NODE);

    expect(res.status).toBe(403);
    expect(body.error).toBe('api_key_read_only');
    expect(applyEffectsTo).not.toHaveBeenCalled();
  });
});
