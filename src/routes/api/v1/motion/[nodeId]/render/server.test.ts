import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BROWSER_RENDER_CREDITS } from '$lib/motion/render-place';

const ORG = 'org-1';
const NODE = 'node-1';
const USER = 'user-1';

const store = vi.hoisted(() => ({
  caller: null as null | Record<string, unknown>,
  gate: null as null | Response,
  head: 3 as number | null,
  runs: [] as Record<string, unknown>[],
  farm: [] as Record<string, unknown>[]
}));

vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: async () => (store.caller ? { caller: store.caller } : { error: { status: 401, body: { error: 'unauthenticated' } } }) }));
vi.mock('$lib/server/cli-auth', () => ({ gateOrgAiAction: async () => store.gate ?? undefined }));
vi.mock('$lib/server/repos/canvas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/canvas')>()),
  findNode: async (_db: unknown, input: { orgId: string; nodeId: string }) =>
    input.orgId === ORG && input.nodeId === NODE ? { id: NODE, orgId: ORG, projectId: 'project-1', canvasId: 'canvas-1', type: 'motion', displayName: 'Launch', data: { format: '16:9', docHeadRevision: store.head, posterAssetId: null, lastRenderAssetId: null } } : null
}));
vi.mock('$lib/server/repos/projects', () => ({ findProjectById: async () => ({ id: 'project-1', brandId: null }) }));
vi.mock('$lib/server/repos/motion-revisions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/motion-revisions')>()),
  readHead: async () => {
    if (!store.head) {
      return null;
    }
    const { newMotionDoc, MotionFormat } = await import('$lib/motion/doc');
    return { version: store.head, doc: newMotionDoc(MotionFormat.Landscape), summary: null, actorKind: 'user' };
  }
}));
vi.mock('$lib/server/repos/node-runs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/node-runs')>()),
  createRun: async (_db: unknown, input: Record<string, unknown>) => {
    store.runs.push(input);
    return { id: 'run-1', ...input };
  }
}));
vi.mock('$lib/server/motion/render-start', () => ({
  startFarmRender: async (_db: unknown, input: Record<string, unknown>) => {
    store.farm.push(input);
    return { ok: true, runId: 'farm-1', quote: { credits: 12 } };
  }
}));

import { POST } from './+server';

const post = (body: unknown, nodeId = NODE) =>
  POST({ request: new Request('https://feega.app/x', { method: 'POST', body: JSON.stringify(body), headers: { authorization: 'Bearer k' } }), params: { nodeId }, url: new URL(`https://feega.app/api/v1/motion/${nodeId}/render`) } as never);

beforeEach(() => {
  store.caller = { db: {}, orgId: ORG, userId: USER, apiKeyId: 'key-1', writeAllowed: true };
  store.gate = null;
  store.head = 3;
  store.runs = [];
  store.farm = [];
});

describe('POST /api/v1/motion/[nodeId]/render', () => {
  it('il default è un link di render nel browser, gratis, legato alla revisione salvata', async () => {
    const res = await post({});
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toMatchObject({ mode: 'browser', run_id: 'run-1', revision: 3, credits: BROWSER_RENDER_CREDITS });
    expect(body.render_url).toMatch(/^https:\/\/feega\.app\/render\/run-1\.[A-Za-z0-9_-]{40,}$/);
    expect(store.runs[0]).toMatchObject({ orgId: ORG, nodeId: NODE, actorKind: 'agent', actorId: USER, externalJobId: 'browser-render:3' });
    expect(store.farm).toEqual([]);
  });

  it('il browser non passa dal cancello dei crediti', async () => {
    store.gate = new Response(JSON.stringify({ error: 'credits_exhausted' }), { status: 402 });
    expect((await post({})).status).toBe(201);
  });

  it('mode server è esplicito, a pagamento, e passa dal cancello', async () => {
    const res = await post({ mode: 'server', settings: { resolution: '720p' } });
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({ mode: 'server', run_id: 'farm-1', credits: 12 });
    expect(store.farm[0]).toMatchObject({ orgId: ORG, nodeId: NODE, settings: { format: 'mp4-h264', resolution: '720p' } });

    store.gate = new Response(JSON.stringify({ error: 'credits_exhausted' }), { status: 402 });
    expect((await post({ mode: 'server' })).status).toBe(402);
  });

  it('un nodo di un’altra org o inesistente è un 404', async () => {
    expect((await post({}, 'other')).status).toBe(404);
  });

  it('un video mai salvato non si renderizza', async () => {
    store.head = null;
    expect((await post({})).status).toBe(409);
  });

  it('una chiave in sola lettura non chiede render', async () => {
    store.caller = { ...store.caller, writeAllowed: false };
    expect((await post({})).status).toBe(403);
  });

  it('un formato sconosciuto è rifiutato prima di tutto', async () => {
    expect((await post({ settings: { format: 'avi' } })).status).toBe(400);
  });
});
