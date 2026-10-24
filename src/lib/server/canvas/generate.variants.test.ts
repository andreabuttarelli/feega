import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { runGenNode, type StartRun } from './generate';

const ORG = '11111111-1111-1111-1111-111111111111';
const NODE = '22222222-2222-2222-2222-222222222222';
const PROJECT = '44444444-4444-4444-4444-444444444444';
const USER = '55555555-5555-5555-5555-555555555555';
const CANVAS = '66666666-6666-6666-6666-666666666666';
const MODEL = 'nano-banana-2';
const GROUP = 'group-1';

const generateImagesWithoutBrand = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/media-generate', () => ({ generateImagesWithoutBrand, generateVideoWithoutBrand: vi.fn() }));
vi.mock('$lib/server/generation/discount-routes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/generation/discount-routes')>()),
  discountBook: async () => null
}));
vi.mock('$lib/server/offerable-models', () => ({
  PricingView: { Offered: 'offered', Primary: 'primary' },
  offerableModels: async () => ({ synced: true, choices: [{ id: MODEL, label: 'NB2', aspectRatios: ['1:1'], provider: 'google', providerLabel: 'Google' }] })
}));
vi.mock('$lib/server/moderation/model-input', () => ({ screenModelInput: async () => ({ ok: true }) }));
vi.mock('./node-model', () => ({ resolveModelIn: async (_mode: string, _m: string, model: string | null) => ({ ok: true, model }) }));
vi.mock('$lib/server/model-allowlist/allowlist', () => ({ allowlistRefusal: async () => null }));
vi.mock('$lib/server/spend-caps/gate', () => ({ capRefusal: async () => null, liveCapReader: async () => ({}) }));
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

const node = {
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
  data: {},
  version: 1,
  deleted_at: null
};

const landing = (n: number) => ({ ok: true, media: [{ storage_path: `${USER}/media/${n}.png`, mime: 'image/png', width: 1024, height: 1024 }], costUsd: 0.04 });

const start = (variants?: StartRun['variants']): StartRun => ({
  orgId: ORG,
  projectId: PROJECT,
  canvasId: CANVAS,
  nodeId: NODE,
  userId: USER,
  medium: 'image',
  prompt: 'a lake',
  model: MODEL,
  params: {},
  expectedVersion: 1,
  variants
});

const sharing = { group: GROUP, source: NODE, sharesNode: true };

const world = () =>
  fakeDb(
    { nodes: [{ ...node }], nodes_connections: [], assets: [], node_runs: [], canvas_events: [], projects: [{ id: PROJECT, org_id: ORG, mode: 'standard' }] },
    { filter: true, mutate: true, store: true }
  );

beforeEach(() => {
  generateImagesWithoutBrand.mockReset();
});

describe('variants into one node history', () => {
  it('lets runs started on the same node version both begin', async () => {
    generateImagesWithoutBrand.mockResolvedValueOnce(landing(1)).mockResolvedValueOnce(landing(2));
    const { db } = world();

    const outs = await Promise.all([runGenNode(db, start(sharing)), runGenNode(db, start(sharing))]);

    expect(outs.map((o) => o.kind)).toEqual(['done', 'done']);
  });

  it('a plain second run on a stale version still conflicts', async () => {
    generateImagesWithoutBrand.mockResolvedValue(landing(1));
    const { db } = world();

    const outs = await Promise.all([runGenNode(db, start()), runGenNode(db, start())]);

    expect(outs.map((o) => o.kind).sort()).toEqual(['conflict', 'done']);
  });

  it('keeps the node running until the last sibling lands', async () => {
    const release: Array<() => void> = [];
    generateImagesWithoutBrand.mockImplementation(
      () => new Promise((resolve) => release.push(() => resolve(landing(release.length))))
    );
    const { db } = world();
    const read = async () => (await db.from('nodes').select('data').eq('id', NODE).single()).data as { data: Record<string, unknown> };

    const first = runGenNode(db, start(sharing));
    const second = runGenNode(db, start(sharing));
    await vi.waitFor(() => expect(release).toHaveLength(2));

    release[0]();
    await first;
    expect((await read()).data.running).toBe(true);

    release[1]();
    await second;
    expect((await read()).data.running).toBe(false);
  });

  it('tags every run with its group so a cancel can find them', async () => {
    generateImagesWithoutBrand.mockResolvedValue(landing(1));
    const { db, calls } = world();

    await runGenNode(db, start(sharing));

    const created = calls.find((c) => c.table === 'node_runs' && c.op === 'insert')!.payload as { params: Record<string, unknown> };
    expect(created.params).toMatchObject({ variantGroup: GROUP, variantSource: NODE });
  });
});
