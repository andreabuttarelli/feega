import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LinkRefusal, RENDER_LINK_OPEN_MS } from '$lib/motion/render-link';

const ORG = 'org-1';
const NODE = 'node-1';
const RUN = 'run-1';

const store = vi.hoisted(() => ({
  run: null as null | Record<string, unknown>,
  completed: [] as unknown[],
  failed: [] as unknown[],
  saved: [] as Record<string, unknown>[],
  revisions: [] as unknown[]
}));

vi.mock('$lib/server/db/client', () => ({ createServiceRoleDb: () => ({ storage: { from: () => ({ createSignedUploadUrl: async (path: string) => ({ data: { token: `upload-${path}` }, error: null }) }) } }) }));
vi.mock('$lib/server/repos/node-runs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/node-runs')>()),
  runsByIds: async ({}, input: { ids: string[] }) => (store.run && input.ids.includes(RUN) ? [store.run] : []),
  setRunParams: async (_db: unknown, input: { params: Record<string, unknown> }) => {
    store.run = { ...store.run, params: input.params };
  },
  completeRun: async (_db: unknown, input: unknown) => {
    store.completed.push(input);
    store.run = { ...store.run, status: 'done' };
  },
  failRun: async (_db: unknown, input: unknown) => {
    store.failed.push(input);
    store.run = { ...store.run, status: 'failed' };
  }
}));
vi.mock('$lib/server/repos/canvas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/canvas')>()),
  findNode: async () => ({ id: NODE, projectId: 'project-1', canvasId: 'canvas-1', displayName: 'Launch' })
}));
vi.mock('$lib/server/repos/projects', () => ({ findProjectById: async () => ({ id: 'project-1', brandId: null }) }));
vi.mock('$lib/server/repos/motion-revisions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/motion-revisions')>()),
  readRevision: async (_db: unknown, input: { version: number }) => {
    store.revisions.push(input.version);
    const { newMotionDoc, MotionFormat } = await import('$lib/motion/doc');
    return { version: input.version, doc: newMotionDoc(MotionFormat.Landscape), summary: null, actorKind: 'user' };
  }
}));
vi.mock('$lib/server/motion/editor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/motion/editor')>()),
  motionAssets: async () => [],
  motionTokens: async () => ({})
}));
vi.mock('$lib/server/motion/audio-analysis', () => ({ analyzeSounds: async () => ({}), storageAnalysis: () => ({}) }));
vi.mock('$lib/server/motion/export', () => ({
  saveExport: async (_db: unknown, input: Record<string, unknown>) => {
    store.saved.push(input);
    return { ok: true, assetId: 'asset-1' };
  }
}));

import { actions, load } from './+page.server';
import { createRenderLink } from '$lib/server/motion/render-link';
import { fakeDb } from '$lib/server/db/fake-db';

function jar(initial: Record<string, string> = {}) {
  const values = { ...initial };
  return { values, get: (name: string) => values[name], set: (name: string, value: string) => (values[name] = value) };
}

const runRow = (params: Record<string, unknown>) => ({ id: RUN, orgId: ORG, nodeId: NODE, prompt: null, model: 'browser', params, status: 'running', error: null, outputAssetId: null, externalJobId: 'browser-render:4', costUsd: null, attempts: 0, actorId: 'user-1', startedAt: '', finishedAt: null });

async function mint(now = Date.now()) {
  const row = { id: RUN, org_id: ORG, node_id: NODE, params: {}, status: 'running' };
  const { db, calls } = fakeDb({ node_runs: [row] });
  const link = await createRenderLink(db, { orgId: ORG, nodeId: NODE, version: 4, actor: { kind: 'agent', id: 'user-1', agentKey: 'mcp' } }, now);
  store.run = runRow((calls.find((c) => c.op === 'insert')!.payload as { params: Record<string, unknown> }).params);
  return link.token;
}

const pageEvent = (token: string, cookies = jar()) => ({ params: { token }, cookies, setHeaders: vi.fn() }) as never;
const form = (fields: Record<string, string>) => {
  const body = new FormData();
  Object.entries(fields).forEach(([k, v]) => body.set(k, v));
  return { formData: async () => body };
};
const actionEvent = (token: string, cookies: ReturnType<typeof jar>, fields: Record<string, string> = {}) => ({ params: { token }, cookies, request: form(fields) }) as never;

beforeEach(() => {
  store.run = null;
  store.completed = [];
  store.failed = [];
  store.saved = [];
  store.revisions = [];
});

describe('/render/[token]', () => {
  it('la prima apertura reclama il link per questo dispositivo e dà la revisione legata', async () => {
    const token = await mint();
    const cookies = jar();

    const page = (await load(pageEvent(token, cookies))) as { refused: null; render: { revision: number; name: string } };

    expect(page.refused).toBeNull();
    expect(page.render).toMatchObject({ revision: 4, name: 'Launch' });
    expect(store.revisions).toEqual([4]);
    expect(Object.keys(cookies.values)).toEqual([`feega_render_${RUN}`]);
  });

  it('un secondo dispositivo, senza il cookie, è rifiutato', async () => {
    const token = await mint();
    await load(pageEvent(token, jar()));

    expect(await load(pageEvent(token, jar()))).toMatchObject({ refused: LinkRefusal.Elsewhere, render: null });
  });

  it('un token alterato non apre niente', async () => {
    const token = await mint();
    expect(await load(pageEvent(`${token}x`))).toMatchObject({ refused: LinkRefusal.Invalid });
    expect(await load(pageEvent('garbage'))).toMatchObject({ refused: LinkRefusal.Invalid });
  });

  it('scaduto prima di essere aperto', async () => {
    const token = await mint(Date.now() - RENDER_LINK_OPEN_MS - 1);
    expect(await load(pageEvent(token))).toMatchObject({ refused: LinkRefusal.Expired });
  });

  it('carica nel percorso fisso del run, salva l’asset e chiude il run: poi il link è usato', async () => {
    const token = await mint();
    const cookies = jar();
    await load(pageEvent(token, cookies));

    const slot = (await actions.slot(actionEvent(token, cookies))) as { path: string };
    expect(slot.path).toBe(`${ORG}/project-1/motion/${NODE}/${RUN}.mp4`);

    expect(await actions.finish(actionEvent(token, cookies, { width: '1280', height: '720', seconds: '2' }))).toEqual({ assetId: 'asset-1' });
    expect(store.saved[0]).toMatchObject({ orgId: ORG, nodeId: NODE, path: slot.path, width: 1280, actor: { kind: 'agent', id: 'user-1' } });
    expect(store.completed).toEqual([{ orgId: ORG, runId: RUN, assetId: 'asset-1', costUsd: 0 }]);

    expect(await load(pageEvent(token, cookies))).toMatchObject({ refused: LinkRefusal.Used });
    expect(await actions.finish(actionEvent(token, cookies, { width: '1280', height: '720', seconds: '2' }))).toMatchObject({ status: 410 });
  });

  it('le azioni senza il cookie del dispositivo che l’ha aperto sono rifiutate', async () => {
    const token = await mint();
    await load(pageEvent(token, jar()));

    expect(await actions.slot(actionEvent(token, jar()))).toMatchObject({ status: 410, data: { error: LinkRefusal.Elsewhere } });
    expect(await actions.finish(actionEvent(token, jar(), { width: '1', height: '1', seconds: '1' }))).toMatchObject({ status: 410 });
    expect(store.saved).toEqual([]);
  });

  it('un’azione su un link mai aperto non lo reclama', async () => {
    const token = await mint();
    expect(await actions.slot(actionEvent(token, jar()))).toMatchObject({ status: 410, data: { error: LinkRefusal.Elsewhere } });
  });

  it('annullare chiude il run', async () => {
    const token = await mint();
    const cookies = jar();
    await load(pageEvent(token, cookies));

    expect(await actions.cancel(actionEvent(token, cookies, { reason: 'cancelled' }))).toEqual({ cancelled: true });
    expect(store.failed).toEqual([{ orgId: ORG, runId: RUN, error: 'cancelled' }]);
  });
});
