import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG = 'org-1';

const store = vi.hoisted(() => ({ runs: [] as Record<string, unknown>[] }));

const signed = { createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://files/${path}?sig` } }) };
vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: async () => ({ caller: { db: { storage: { from: () => signed } }, orgId: ORG, userId: 'user-1' } }) }));
vi.mock('$lib/server/repos/node-runs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/node-runs')>()),
  runsByIds: async (_db: unknown, input: { ids: string[] }) => store.runs.filter((r) => input.ids.includes(String(r.id)))
}));
vi.mock('$lib/server/repos/assets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/assets')>()),
  findAsset: async (_db: unknown, input: { assetId: string }) => ({ id: input.assetId, url: `${ORG}/p/motion/n/${input.assetId}.mp4` })
}));

import { GET } from './+server';

const get = (runId: string) => GET({ request: new Request('https://feega.app/x'), params: { runId }, url: new URL('https://feega.app/x') } as never);
const run = (over: Record<string, unknown>) => ({ id: 'run-1', orgId: ORG, nodeId: 'node-1', params: { revision: 3 }, status: 'running', error: null, outputAssetId: null, externalJobId: 'browser-render:3', costUsd: null, startedAt: 's', finishedAt: null, ...over });

beforeEach(() => (store.runs = []));

describe('GET /api/v1/motion/renders/[runId]', () => {
  it('un render nel browser finito dà l’asset e un URL firmato del file', async () => {
    store.runs = [run({ status: 'done', outputAssetId: 'asset-1' })];
    const body = await (await get('run-1')).json();
    expect(body).toMatchObject({ run_id: 'run-1', mode: 'browser', status: 'done', asset_id: 'asset-1', credits: 0, revision: 3 });
    expect(body.file_url).toBe(`https://files/${ORG}/p/motion/n/asset-1.mp4?sig`);
  });

  it('in corso non ha file', async () => {
    store.runs = [run({})];
    expect(await (await get('run-1')).json()).toMatchObject({ status: 'running', file_url: null });
  });

  it('un render sul farm si legge uguale, col suo modo', async () => {
    store.runs = [run({ externalJobId: 'motion-render:3', params: { revision: 3, quote: { credits: 9 } } })];
    expect(await (await get('run-1')).json()).toMatchObject({ mode: 'server', credits: 9 });
  });

  it('un run di un’altra org, o che non è un render, è un 404', async () => {
    store.runs = [run({ orgId: 'other' }), run({ id: 'ask', externalJobId: null })];
    expect((await get('run-1')).status).toBe(404);
    expect((await get('ask')).status).toBe(404);
  });
});
