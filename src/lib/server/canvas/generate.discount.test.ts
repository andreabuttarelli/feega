import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import type { Db } from '$lib/server/db/client';
import type { ModelChoice } from '$lib/canvas/gen-node';
import { computeCostUsd } from '$lib/server/ai-log';
import { kieModelRows } from '$lib/server/kie-catalogue';
import { discountCandidateOf, RouteHealth, type DiscountCandidate } from '$lib/server/generation/discount-route';
import type { DiscountBook } from '$lib/server/generation/discount-routes';
import { TaskProviderName } from '$lib/server/generation/task-providers';
import type { TaskBill, TaskModel, TaskRunDeps } from './task-run';
import { reconcileTaskNodeRuns, runGenNode } from './generate';

const ORG = '11111111-1111-1111-1111-111111111111';
const NODE = '22222222-2222-2222-2222-222222222222';
const RUN = '33333333-3333-3333-3333-333333333333';
const PROJECT = '44444444-4444-4444-4444-444444444444';
const USER = '55555555-5555-5555-5555-555555555555';
const CANVAS = '66666666-6666-6666-6666-666666666666';
const PRIMARY = 'nano-banana-2';
const KIE_MODEL = 'kie/nano-banana-2';

const kieRow = kieModelRows('2026-10-15T00:00:00.000Z').find((row) => row.id === KIE_MODEL)!;
const kieModel: TaskModel = {
  id: KIE_MODEL,
  catalogue: 'image',
  spec: kieRow.wire_spec as TaskModel['spec'],
  uncensored: false,
  paramSchema: {},
  pricing: kieRow.pricing
};

const book: DiscountBook = {
  provider: TaskProviderName.Kie,
  candidates: new Map([[PRIMARY, discountCandidateOf(kieRow) as DiscountCandidate]]),
  health: RouteHealth.Healthy
};

const primaryChoice: ModelChoice = { id: PRIMARY, label: 'Nano Banana 2', aspectRatios: ['1:1'], provider: 'google', providerLabel: 'Google', variableCredits: true };

const gateway = { run: vi.fn(), task: vi.fn() };
const bill = vi.fn<(entry: TaskBill) => void>();
const generateImagesWithoutBrand = vi.hoisted(() => vi.fn());

const { deps } = vi.hoisted(() => ({ deps: { current: null as null | ((db: Db) => TaskRunDeps) } }));
vi.mock('$lib/server/task-providers-config', () => ({ taskRunDeps: (db: Db) => deps.current!(db) }));
vi.mock('$lib/server/media-generate', () => ({ generateImagesWithoutBrand, generateVideoWithoutBrand: vi.fn() }));
vi.mock('$lib/server/generation/discount-routes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/generation/discount-routes')>()),
  discountBook: async () => book
}));
vi.mock('$lib/server/offerable-models', () => ({
  PricingView: { Offered: 'offered', Primary: 'primary' },
  offerableModels: async () => ({ synced: true, choices: [primaryChoice] })
}));
vi.mock('$lib/server/moderation/model-input', () => ({ screenModelInput: async () => ({ ok: true }) }));
vi.mock('./node-model', () => ({ resolveNodeModel: async (_m: string, model: string | null) => ({ ok: true, model }) }));
vi.mock('$lib/server/canvas/upstream', () => ({
  upstreamInputsFor: async () => ({
    text: [],
    referenceImageUrl: null,
    referenceImageUrls: [],
    pickedImageUrls: [],
    referenceVideoUrls: [],
    referenceAudioUrls: [],
    startFrameUrl: null,
    endFrameUrl: null,
    blocked: null,
    rejected: []
  })
}));

beforeEach(() => {
  for (const fn of [gateway.run, gateway.task, bill, generateImagesWithoutBrand]) {
    fn.mockReset();
  }
  generateImagesWithoutBrand.mockResolvedValue({ ok: true, media: [{ storage_path: `${USER}/media/primary.png`, mime: 'image/png', width: 1024, height: 1024 }], costUsd: 0.067 });
  deps.current = () => ({
    providers: { kie: gateway },
    model: async (id) => (id === KIE_MODEL ? kieModel : null),
    access: async () => ({ allowed: true }),
    screen: () => ({
      decide: async () => ({ choice: 'safe', probabilities: { safe: 1 } }),
      judge: async () => ({ allowed: true, category: 'none', reason: '' }),
      decideIdentifiability: async () => ({ choice: 'generic', probabilities: { generic: 1 } }),
      judgeIdentifiability: async () => ({ allowed: true, category: 'generic', reason: '' }),
      record: () => {}
    }),
    refuseLikeness: vi.fn(),
    bill
  });
});

const imageNode = (data: Record<string, unknown> = {}) => ({
  id: NODE,
  org_id: ORG,
  project_id: PROJECT,
  canvas_id: CANVAS,
  type: 'image',
  display_name: null,
  x: 0,
  y: 0,
  z: 0,
  width: null,
  height: null,
  data,
  version: 1
});

function canvas(extra: Record<string, unknown[]> = {}) {
  return fakeDb({ nodes: [imageNode()], nodes_connections: [], assets: [], projects: [{ id: PROJECT, org_id: ORG, mode: 'standard' }], ...extra }, { updateRows: { nodes: [{ ...imageNode(), version: 2 }] } });
}

const start = { orgId: ORG, projectId: PROJECT, canvasId: CANVAS, nodeId: NODE, userId: USER, medium: 'image' as const, prompt: 'a lake', model: PRIMARY, params: {}, expectedVersion: 1 };

const runUpdates = (calls: ReturnType<typeof fakeDb>['calls']) =>
  calls.filter((c) => c.table === 'node_runs' && c.op === 'update').map((c) => c.payload as Record<string, unknown>);

const debited = (entry: TaskBill) =>
  computeCostUsd({ label: 'canvas.kie', provider: entry.provider, model: entry.model, ms: entry.ms, ok: !entry.error, error: entry.error, flatCostUsd: entry.costUsd ?? undefined });

describe('kie is tried first for a model it discounts', () => {
  it('queues the render on kie, at kie\'s default resolution, remembering the primary to fall back to', async () => {
    gateway.run.mockResolvedValue({ taskId: 'task_42' });
    const { db, calls } = canvas();

    const out = await runGenNode(db, start);

    expect(out.kind).toBe('queued');
    expect(gateway.run).toHaveBeenCalledWith(expect.objectContaining({ model: 'nano-banana-2' }), expect.objectContaining({ prompt: 'a lake', resolution: '1K' }), expect.any(String));
    expect(runUpdates(calls)).toContainEqual(expect.objectContaining({ model: KIE_MODEL, params: { resolution: '1K', fallbackModel: PRIMARY } }));
    expect(runUpdates(calls)).toContainEqual(expect.objectContaining({ external_job_id: 'kie:task_42' }));
    expect(generateImagesWithoutBrand).not.toHaveBeenCalled();
  });

  it('a kie submit error runs the primary in the same request; the failed attempt is recorded and debits nothing', async () => {
    gateway.run.mockRejectedValue(new Error('kie_failed: HTTP 500 on /jobs/createTask'));
    const { db, calls } = canvas();

    const out = await runGenNode(db, start);

    expect(out.kind).toBe('done');
    expect(generateImagesWithoutBrand).toHaveBeenCalledOnce();
    expect(generateImagesWithoutBrand).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ model: PRIMARY }));
    expect(bill).toHaveBeenCalledOnce();
    expect(bill.mock.calls[0][0]).toMatchObject({ provider: 'kie', costUsd: null, error: 'kie_failed: HTTP 500 on /jobs/createTask' });
    expect(debited(bill.mock.calls[0][0])).toBeNull();
    expect(runUpdates(calls)).toContainEqual(expect.objectContaining({ model: PRIMARY }));
  });
});

const nodeWrites = (calls: ReturnType<typeof fakeDb>['calls']) =>
  calls.filter((c) => c.table === 'nodes' && c.op === 'update').map((c) => JSON.stringify(c.payload));

describe('the provider saved on the node decides the route', () => {
  it('OpenRouter picked by hand never touches kie', async () => {
    const { db } = canvas();

    const out = await runGenNode(db, { ...start, params: { provider: 'openrouter' } });

    expect(out.kind).toBe('done');
    expect(gateway.run).not.toHaveBeenCalled();
    expect(generateImagesWithoutBrand).toHaveBeenCalledOnce();
  });

  it('kie picked by hand that fails is refused with a clear reason, and never silently moves to OpenRouter', async () => {
    gateway.run.mockRejectedValue(new Error('kie_failed: HTTP 500 on /jobs/createTask'));
    const { db } = canvas();

    const out = await runGenNode(db, { ...start, params: { provider: 'kie' } });

    expect(out).toEqual({ kind: 'refused', error: expect.stringMatching(/^Kie\.ai failed: .*Pick Auto/) });
    expect(generateImagesWithoutBrand).not.toHaveBeenCalled();
  });

  it('kie picked by hand queues without a fallback model', async () => {
    gateway.run.mockResolvedValue({ taskId: 'task_9' });
    const { db, calls } = canvas();

    await runGenNode(db, { ...start, params: { provider: 'kie' } });

    expect(runUpdates(calls)).toContainEqual(expect.objectContaining({ model: KIE_MODEL, params: { resolution: '1K', provider: 'kie' } }));
  });

  it('Auto that falls back says so on the node', async () => {
    gateway.run.mockRejectedValue(new Error('kie_failed: HTTP 500 on /jobs/createTask'));
    const { db, calls } = canvas();

    await runGenNode(db, start);

    expect(nodeWrites(calls).some((w) => w.includes('"routeNote":"Kie.ai failed, made on OpenRouter"'))).toBe(true);
  });
});

describe('a kie task that fails falls back to the primary once, and only the primary charges', () => {
  const queued = {
    id: RUN,
    org_id: ORG,
    node_id: NODE,
    prompt: 'a lake',
    model: KIE_MODEL,
    params: { resolution: '1K', fallbackModel: PRIMARY },
    status: 'running',
    error: null,
    output_asset_id: null,
    external_job_id: 'kie:task_42',
    cost_usd: null,
    attempts: 0,
    claimed_at: null,
    started_at: new Date().toISOString(),
    finished_at: null,
    actor_kind: 'user',
    actor_id: USER
  };

  it('fails the kie run, renders on the primary, and the kie attempt debits nothing', async () => {
    gateway.task.mockResolvedValue({ state: 'failed', error: 'kie_task_failed: Internal error, please try again later.' });
    const { db, calls } = canvas({ node_runs: [queued], nodes: [imageNode({ running: true, runId: RUN })] });

    await reconcileTaskNodeRuns(db);

    expect(runUpdates(calls)).toContainEqual(expect.objectContaining({ status: 'failed', error: 'kie_task_failed: Internal error, please try again later.' }));
    expect(generateImagesWithoutBrand).toHaveBeenCalledOnce();
    expect(generateImagesWithoutBrand).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ model: PRIMARY }));
    expect(bill).toHaveBeenCalledOnce();
    expect(debited(bill.mock.calls[0][0])).toBeNull();
    expect(gateway.run).not.toHaveBeenCalled();
  });

  it('a kie task that finishes charges kie\'s price and never touches the primary', async () => {
    gateway.task.mockResolvedValue({ state: 'done', costUsd: 0.04, outputs: [{ url: 'https://tempfile.aiquickdraw.com/h/ab12.png', contentType: 'image/png' }] });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } })));
    const { db } = canvas({ node_runs: [queued], nodes: [imageNode({ running: true, runId: RUN })] });

    expect(await reconcileTaskNodeRuns(db)).toMatchObject({ done: 1 });

    expect(generateImagesWithoutBrand).not.toHaveBeenCalled();
    expect(bill).toHaveBeenCalledOnce();
    expect(bill.mock.calls[0][0]).toMatchObject({ provider: 'kie', costUsd: 0.04, quotedUsd: 0.04 });
    expect(debited(bill.mock.calls[0][0])).toBe(0.04);
  });
});
