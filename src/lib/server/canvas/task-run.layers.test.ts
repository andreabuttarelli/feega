import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectMode } from '$lib/project-mode';

const { insertAsset } = vi.hoisted(() => ({ insertAsset: vi.fn(async (_db: unknown, input: { url: string }) => ({ id: `asset-${input.url.split('/').pop()}`, url: input.url })) }));

vi.mock('$lib/server/repos/assets', async (importOriginal) => ({ ...(await importOriginal<typeof import('$lib/server/repos/assets')>()), insertAsset }));
vi.mock('$lib/server/content-credentials', () => ({ markGenerated: async (bytes: Buffer) => ({ bytes, marked: false }) }));

import { finishTaskJob, type TaskModel } from './task-run';

const SCOPE = { orgId: 'org-1', projectId: 'p1', canvasId: 'c1', nodeId: 'n1', userId: 'u1' };

const db = { storage: { from: () => ({ upload: async () => ({ error: null }) }) } } as never;

function modelOf(spec: Record<string, unknown>): TaskModel {
  return { id: 'kie/seedream/5-flash-layer-decomposition', catalogue: 'image', spec: { fields: { images: ['image_url'] }, ...spec }, uncensored: false, paramSchema: {} } as TaskModel;
}

const OUTPUTS = ['base', 'layer-1', 'layer-2'].map((name) => ({ url: `https://files.test/${name}.png`, contentType: 'image/png' }));

function providers() {
  return { kie: { run: vi.fn(), task: vi.fn().mockResolvedValue({ state: 'done', outputs: OUTPUTS, costUsd: 0.12 }) } };
}

const job = { externalJobId: 'kie:task_9', modelId: 'kie/seedream/5-flash-layer-decomposition', scope: SCOPE, mode: ProjectMode.Standard, params: {}, startedAt: '2026-10-24T10:00:00.000Z' };

afterEach(() => {
  vi.unstubAllGlobals();
  insertAsset.mockClear();
});

describe('finishTaskJob keeps the extra outputs of a layer model', () => {
  it('lands the first output as the result and every other one as a layer, in order', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } })));

    const out = await finishTaskJob(db, { providers: providers(), model: async () => modelOf({ layers: true }), bill: vi.fn() }, job);

    expect(out).toMatchObject({ state: 'landed', layers: [expect.objectContaining({ id: expect.any(String) }), expect.objectContaining({ id: expect.any(String) })] });
    expect(insertAsset).toHaveBeenCalledTimes(3);
  });

  it('a model without layers deposits one asset and no layers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/png' } })));

    const out = await finishTaskJob(db, { providers: providers(), model: async () => modelOf({}), bill: vi.fn() }, job);

    expect(out).toMatchObject({ state: 'landed', layers: [] });
    expect(insertAsset).toHaveBeenCalledTimes(1);
  });
});
