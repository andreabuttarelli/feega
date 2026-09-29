import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * `run_node_generation` DEVE ESSERE LA STESSA PORTA DEL BOTTONE «GENERA» SULLA TELA, MAI UNA
 * PARALLELA. Questi test tengono ferme le tre cose che un secondo percorso rischierebbe di
 * dimenticare: il cancello crediti (`gateOrgAiAction`), la concorrenza ottimistica su
 * `nodes.version` (`conflict` → 409), e che il motore chiamato è `runGenNode` — lo stesso della
 * action `run` in `+page.server.ts`, non una sua copia.
 */

const resolveOrgCaller = vi.fn();
const gateOrgAiAction = vi.fn();
const runGenNode = vi.fn();
const findNode = vi.fn();

vi.mock('$lib/server/org-data/auth', () => ({
  resolveOrgCaller: (...args: unknown[]) => resolveOrgCaller(...args)
}));
vi.mock('$lib/server/cli-auth', () => ({
  gateOrgAiAction: (...args: unknown[]) => gateOrgAiAction(...args)
}));
vi.mock('$lib/server/canvas/generate', () => ({
  runGenNode: (...args: unknown[]) => runGenNode(...args)
}));
vi.mock('$lib/server/repos/canvas', () => ({
  findNode: (...args: unknown[]) => findNode(...args)
}));

const canvasModelCatalogue = vi.fn();
vi.mock('$lib/server/canvas-catalogue', () => ({
  canvasModelCatalogue: (...args: unknown[]) => canvasModelCatalogue(...args)
}));

import { POST } from './+server';

const CANDIDATES = [
  { id: 'current', label: 'Current', releasedAt: '2026-09-01T00:00:00Z', expiresAt: null, unitCostUsd: 0.04, benchmark: null, capability: 1 },
  { id: 'ancient', label: 'Ancient', releasedAt: '2024-01-01T00:00:00Z', expiresAt: null, unitCostUsd: 0.04, benchmark: null, capability: 1 }
];
const IMAGE_CATALOGUE = {
  choices: [],
  synced: true,
  candidates: CANDIDATES,
  recommended: [{ tier: 'balanced', id: 'current', label: 'Current', unitCostUsd: 0.04, releasedAt: '2026-09-01T00:00:00Z', why: '' }]
};

const ORG = 'org-1';
const NODE = 'node-1';
const PROJECT = 'project-1';
const CANVAS = 'canvas-1';
const USER = 'user-1';

function call(id: string, body: unknown) {
  const url = new URL(`https://feega.test/api/v1/org/nodes/${id}/generate`);
  return (POST as (event: unknown) => Promise<Response>)({
    request: new Request(url, {
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: JSON.stringify(body)
    }),
    params: { id },
    url
  }).then(async (res) => ({ res, body: await res.json() }));
}

const NODE_ROW = {
  id: NODE,
  canvasId: CANVAS,
  projectId: PROJECT,
  type: 'image',
  version: 3
};

beforeEach(() => {
  vi.clearAllMocks();
  resolveOrgCaller.mockResolvedValue({
    caller: { db: {}, orgId: ORG, userId: USER, writeAllowed: true, apiKeyId: 'key-1' }
  });
  gateOrgAiAction.mockResolvedValue(undefined);
  findNode.mockResolvedValue(NODE_ROW);
  canvasModelCatalogue.mockResolvedValue({ image: IMAGE_CATALOGUE });
});

describe('POST /api/v1/org/nodes/:id/generate', () => {
  it('runs the SAME engine the canvas Generate button calls, with expectedVersion carried through', async () => {
    runGenNode.mockResolvedValue({
      kind: 'done',
      run: { id: 'run-1', status: 'done', outputAssetId: 'asset-1' },
      asset: { id: 'asset-1', type: 'image', url: 'https://feega.app/a/1' }
    });

    const { res, body } = await call(NODE, {
      medium: 'image',
      prompt: 'a cat on a skateboard',
      model: 'openai/gpt-image',
      version: 3,
      params: { aspectRatio: '1:1' }
    });

    expect(res.status).toBe(200);
    expect(runGenNode).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        orgId: ORG,
        projectId: PROJECT,
        canvasId: CANVAS,
        nodeId: NODE,
        userId: USER,
        medium: 'image',
        prompt: 'a cat on a skateboard',
        model: 'openai/gpt-image',
        expectedVersion: 3
      })
    );
    expect(body.kind).toBe('done');
  });

  it('gates on org credits before ever calling runGenNode', async () => {
    gateOrgAiAction.mockResolvedValue(new Response(JSON.stringify({ error: 'credits_exhausted' }), { status: 402 }));

    const { res } = await call(NODE, { medium: 'image', prompt: 'x', model: 'm', version: 1, params: {} });

    expect(res.status).toBe(402);
    expect(runGenNode).not.toHaveBeenCalled();
  });

  it('surfaces a stale nodes.version as 409, never a silent overwrite', async () => {
    runGenNode.mockResolvedValue({ kind: 'conflict' });

    const { res, body } = await call(NODE, { medium: 'image', prompt: 'x', model: 'm', version: 1, params: {} });

    expect(res.status).toBe(409);
    expect(body.conflict).toBe(true);
  });

  it('refuses when medium does not match the node type', async () => {
    findNode.mockResolvedValue({ ...NODE_ROW, type: 'video' });

    const { res, body } = await call(NODE, { medium: 'image', prompt: 'x', model: 'm', version: 3, params: {} });

    expect(res.status).toBe(400);
    expect(body.error).toBe('medium_mismatch');
    expect(runGenNode).not.toHaveBeenCalled();
  });

  it('404s when the node does not belong to this org', async () => {
    findNode.mockResolvedValue(null);

    const { res, body } = await call('missing', { medium: 'image', prompt: 'x', model: 'm', version: 1, params: {} });

    expect(res.status).toBe(404);
    expect(body.error).toBe('node_not_found');
    expect(runGenNode).not.toHaveBeenCalled();
  });

  it('rejects a write when the API key is read-only', async () => {
    resolveOrgCaller.mockResolvedValue({
      caller: { db: {}, orgId: ORG, userId: USER, writeAllowed: false, apiKeyId: 'key-1' }
    });

    const { res, body } = await call(NODE, { medium: 'image', prompt: 'x', model: 'm', version: 1, params: {} });

    expect(res.status).toBe(403);
    expect(body.error).toBe('api_key_read_only');
    expect(runGenNode).not.toHaveBeenCalled();
  });

  it('maps a refused outcome (e.g. missing prompt) to 400', async () => {
    runGenNode.mockResolvedValue({ kind: 'refused', error: 'prompt_required' });

    const { res, body } = await call(NODE, { medium: 'image', prompt: '', model: 'm', version: 3, params: {} });

    expect(res.status).toBe(400);
    expect(body.error).toBe('prompt_required');
  });

  it('hands an MCP agent the moderation refusal verbatim, so it can say why', async () => {
    const blocked = "This prompt was blocked: sexual content isn't allowed in feega's standard mode.";
    runGenNode.mockResolvedValue({ kind: 'refused', error: blocked });

    const { res, body } = await call(NODE, { medium: 'image', prompt: 'explicit', model: 'm', version: 3, params: {} });

    expect(res.status).toBe(400);
    expect(body.error).toBe(blocked);
  });

  it('without a model, keeps the one already set on the node', async () => {
    findNode.mockResolvedValue({ ...NODE_ROW, data: { model: 'chosen-by-user' } });
    runGenNode.mockResolvedValue({ kind: 'done', run: { id: 'r' }, asset: { id: 'a' } });

    const { res } = await call(NODE, { medium: 'image', prompt: 'x', version: 3 });

    expect(res.status).toBe(200);
    expect(runGenNode).toHaveBeenCalledWith({}, expect.objectContaining({ model: 'chosen-by-user' }));
  });

  it('without a model anywhere, leaves the balanced pick to the shared resolution', async () => {
    findNode.mockResolvedValue({ ...NODE_ROW, data: {} });
    runGenNode.mockResolvedValue({ kind: 'done', run: { id: 'r' }, asset: { id: 'a' } });

    await call(NODE, { medium: 'image', prompt: 'x', version: 3 });

    expect(runGenNode).toHaveBeenCalledWith({}, expect.objectContaining({ model: null }));
  });

  it('an old model still runs, with a warning naming the recommended one', async () => {
    runGenNode.mockResolvedValue({ kind: 'done', run: { id: 'r' }, asset: { id: 'a' } });

    const { res, body } = await call(NODE, { medium: 'image', prompt: 'x', model: 'ancient', version: 3 });

    expect(res.status).toBe(200);
    expect(runGenNode).toHaveBeenCalledWith({}, expect.objectContaining({ model: 'ancient' }));
    expect(body.warning).toContain('current');
  });

  it('a recommended model carries no warning', async () => {
    runGenNode.mockResolvedValue({ kind: 'done', run: { id: 'r' }, asset: { id: 'a' } });

    const { body } = await call(NODE, { medium: 'image', prompt: 'x', model: 'current', version: 3 });

    expect(body.warning).toBeUndefined();
  });
});
