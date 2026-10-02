import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fakeDb } from '$lib/server/db/fake-db';
import type { Db } from '$lib/server/db/client';
import { reconcileWiroNodeRuns, runGenNode } from './generate';
import type { WiroModel, WiroRunDeps } from './wiro-run';
import type { ScreenPorts } from '$lib/server/moderation/screen';
import { readGlbJson } from '$lib/server/content-credentials';
import { MODEL3D_INPUT_REQUIRED } from '$lib/canvas/model3d-run';

const ORG = '11111111-1111-1111-1111-111111111111';
const NODE = '22222222-2222-2222-2222-222222222222';
const RUN = '33333333-3333-3333-3333-333333333333';
const PROJECT = '44444444-4444-4444-4444-444444444444';
const USER = '55555555-5555-5555-5555-555555555555';
const CANVAS = '66666666-6666-6666-6666-666666666666';

const TRELLIS = 'wiro/microsoft/trellis-2';
const PRODUCT_URL = 'https://cdn.test/product.png';
const GLB_FIXTURE = path.join(import.meta.dirname, '..', 'fixtures', 'triangle.glb');

const trellis: WiroModel = {
  id: TRELLIS,
  catalogue: 'model3d',
  uncensored: false,
  spec: { owner: 'microsoft', project: 'trellis-2', fields: { images: ['inputImage'] } },
  paramSchema: { pipeline_type: { type: 'enum', values: ['512', '1024_cascade'] } }
};

const gateway = { run: vi.fn(), task: vi.fn(), purge: vi.fn() };
const bill = vi.fn();
const screen: ScreenPorts = {
  decide: vi.fn(async () => ({ choice: 'safe', probabilities: { safe: 0.999 } })),
  judge: vi.fn(),
  decideIdentifiability: vi.fn(async () => ({ choice: 'generic', probabilities: { generic: 0.999 } })),
  judgeIdentifiability: vi.fn(async () => ({ allowed: true, category: 'generic', reason: '' })),
  record: vi.fn()
};

const { deps, upstream, imageStep, moderation } = vi.hoisted(() => ({
  deps: { current: null as null | ((db: Db) => WiroRunDeps) },
  upstream: { referenceImageUrls: [] as string[], text: [] as string[] },
  imageStep: { generate: null as unknown as ReturnType<typeof import('vitest').vi.fn> },
  moderation: { screen: null as unknown as ReturnType<typeof import('vitest').vi.fn> }
}));
imageStep.generate = vi.fn();
moderation.screen = vi.fn();
vi.mock('$lib/server/media-generate', () => ({ generateImagesWithoutBrand: (...args: unknown[]) => imageStep.generate(...args) }));
vi.mock('$lib/server/moderation/model-input', () => ({ screenModelInput: (...args: unknown[]) => moderation.screen(...args) }));
vi.mock('$lib/server/offerable-models', () => ({
  offerableModels: async () => ({
    synced: true,
    choices: [
      { id: 'pricey-image', label: 'Pricey', provider: 'x', providerLabel: 'X', aspectRatios: ['1:1'], inputModalities: ['text'], unitCredits: 20 },
      { id: 'cheap-image', label: 'Cheap', provider: 'x', providerLabel: 'X', aspectRatios: ['1:1'], inputModalities: ['text'], unitCredits: 2 }
    ]
  })
}));
vi.mock('./sign-media', () => ({
  signMediaPaths: async (_db: unknown, paths: string[]) => paths.map((p) => (p.startsWith('https://') ? p : `https://signed.test/${p}`))
}));
vi.mock('$lib/server/wiro-config', () => ({ wiroRunDeps: (db: Db) => deps.current!(db) }));
vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('./node-model', () => ({ resolveNodeModel: async (_m: string, model: string | null) => ({ ok: true, model }) }));
vi.mock('$lib/server/canvas/upstream', () => ({
  upstreamInputsFor: async () => ({
    text: upstream.text,
    referenceImageUrl: upstream.referenceImageUrls[0] ?? null,
    referenceImageUrls: upstream.referenceImageUrls,
    pickedImageUrls: [],
    referenceVideoUrls: [],
    referenceAudioUrls: [],
    startFrameUrl: null,
    endFrameUrl: null,
    blocked: null,
    rejected: []
  })
}));

const model3dNode = (data: Record<string, unknown> = {}) => ({
  id: NODE,
  org_id: ORG,
  project_id: PROJECT,
  canvas_id: CANVAS,
  type: 'model3d',
  display_name: null,
  x: 0,
  y: 0,
  z: 0,
  width: null,
  height: null,
  data,
  version: 1
});

const standardProject = { id: PROJECT, org_id: ORG, mode: 'standard' };

const start = () => ({
  orgId: ORG,
  projectId: PROJECT,
  canvasId: CANVAS,
  nodeId: NODE,
  userId: USER,
  medium: 'model3d' as const,
  prompt: '',
  model: TRELLIS,
  params: { pipeline_type: '512' } as Record<string, unknown>,
  expectedVersion: 1
});

beforeEach(() => {
  for (const fn of [gateway.run, gateway.task, gateway.purge, bill]) {
    fn.mockReset();
  }
  gateway.run.mockResolvedValue({ taskId: '9001' });
  upstream.referenceImageUrls = [];
  upstream.text = [];
  imageStep.generate.mockReset();
  imageStep.generate.mockResolvedValue({
    ok: true,
    media: [{ storage_path: `${USER}/media/teapot.png`, mime: 'image/png', width: 1024, height: 1024, ai_marked: true }],
    model: 'cheap-image',
    renders: 1,
    costUsd: 0.02
  });
  moderation.screen.mockReset();
  moderation.screen.mockResolvedValue({ ok: true });
  deps.current = () => ({
    gateway,
    model: async (id) => (id === TRELLIS ? trellis : null),
    access: async () => ({ allowed: true }),
    screen: () => screen,
    refuseLikeness: vi.fn(),
    bill
  });
});

function canvas() {
  return fakeDb(
    { nodes: [model3dNode()], nodes_connections: [], assets: [], projects: [standardProject] },
    { updateRows: { nodes: [{ ...model3dNode(), version: 2 }] } }
  );
}

describe('a 3D node on a Wiro image-to-3D model', () => {
  it('queues a Wiro task from the connected image alone, in a standard project', async () => {
    upstream.referenceImageUrls = [PRODUCT_URL];
    const { db, calls } = canvas();

    const out = await runGenNode(db, start());

    expect(out.kind).toBe('queued');
    expect(gateway.run).toHaveBeenCalledWith({ owner: 'microsoft', project: 'trellis-2' }, { inputImage: PRODUCT_URL, pipeline_type: '512' });
    const job = calls.find((c) => c.table === 'node_runs' && c.op === 'update' && (c.payload as Record<string, unknown>)?.external_job_id);
    expect((job?.payload as Record<string, unknown>).external_job_id).toBe('wiro:9001');
  });

  it('refuses with neither an image nor a text, before spending anything', async () => {
    const { db } = canvas();

    const out = await runGenNode(db, start());

    expect(out).toEqual({ kind: 'refused', error: MODEL3D_INPUT_REQUIRED });
    expect(imageStep.generate).not.toHaveBeenCalled();
    expect(gateway.run).not.toHaveBeenCalled();
  });

  it('refuses a resolution the model does not offer, before spending anything', async () => {
    upstream.referenceImageUrls = [PRODUCT_URL];
    const { db } = canvas();

    const out = await runGenNode(db, { ...start(), params: { pipeline_type: '2048' } as Record<string, unknown> });

    expect(out).toEqual({ kind: 'refused', error: 'Resolution "2048" is not offered by this 3D model.' });
    expect(gateway.run).not.toHaveBeenCalled();
  });

  it('sends Trellis at 512 when the node never picked a resolution, and nothing it does not offer', async () => {
    upstream.referenceImageUrls = [PRODUCT_URL];
    const { db } = canvas();

    await runGenNode(db, { ...start(), params: { repeat: 2 } as Record<string, unknown> });

    expect(gateway.run).toHaveBeenCalledWith({ owner: 'microsoft', project: 'trellis-2' }, { inputImage: PRODUCT_URL, pipeline_type: '512' });
  });
});

describe('a 3D node with text and no image', () => {
  it('first renders a white-background product shot on the cheapest image model, then queues the 3D job on it', async () => {
    const { db, calls } = canvas();

    const out = await runGenNode(db, { ...start(), prompt: 'a red ceramic teapot' });

    expect(out.kind).toBe('queued');
    expect(imageStep.generate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        orgId: ORG,
        userId: USER,
        model: 'cheap-image',
        count: 1,
        aspectRatio: '1:1',
        prompt: expect.stringMatching(/a red ceramic teapot.*white background/s)
      })
    );
    expect(gateway.run).toHaveBeenCalledWith(
      { owner: 'microsoft', project: 'trellis-2' },
      { inputImage: `https://signed.test/${USER}/media/teapot.png`, pipeline_type: '512' }
    );

    const poster = calls.find((c) => c.table === 'assets' && c.op === 'insert' && (c.payload as Record<string, unknown>).type === 'image');
    expect(poster?.payload).toMatchObject({ url: `${USER}/media/teapot.png`, source: 'generated', source_node_id: NODE });
    const shown = calls.find((c) => c.table === 'nodes' && c.op === 'update' && JSON.stringify(c.payload).includes('posterRefId'));
    expect(shown).toBeTruthy();
  });

  it('reads a connected text the same way as its own prompt', async () => {
    upstream.text = ['a brass desk lamp'];
    const { db } = canvas();

    await runGenNode(db, start());

    expect(imageStep.generate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ prompt: expect.stringContaining('a brass desk lamp') }));
  });

  it('screens the text before the image step, and a refusal spends nothing', async () => {
    moderation.screen.mockResolvedValue({ ok: false, error: 'moderation_refused' });
    const { db } = canvas();

    const out = await runGenNode(db, { ...start(), prompt: 'something refused' });

    expect(out).toEqual({ kind: 'refused', error: 'moderation_refused' });
    expect(moderation.screen).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ texts: expect.arrayContaining(['something refused']) }));
    expect(imageStep.generate).not.toHaveBeenCalled();
    expect(gateway.run).not.toHaveBeenCalled();
  });

  it('a failed image step stops the run before the 3D job', async () => {
    imageStep.generate.mockResolvedValue({ ok: false, error: 'render_failed' });
    const { db } = canvas();

    const out = await runGenNode(db, { ...start(), prompt: 'a red ceramic teapot' });

    expect(out).toEqual({ kind: 'refused', error: 'render_failed' });
    expect(gateway.run).not.toHaveBeenCalled();
  });
});

describe('the run tick lands a 3D model', () => {
  const queued = {
    id: RUN,
    org_id: ORG,
    node_id: NODE,
    prompt: '',
    model: TRELLIS,
    params: {},
    status: 'running',
    error: null,
    output_asset_id: null,
    external_job_id: 'wiro:9001',
    cost_usd: null,
    attempts: 0,
    claimed_at: null,
    started_at: new Date().toISOString(),
    finished_at: null,
    actor_kind: 'user',
    actor_id: USER
  };

  it('stores the GLB as a marked model3d asset and keeps the preview render as its poster', async () => {
    const glb = await readFile(GLB_FIXTURE);
    const sharp = (await import('sharp')).default;
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } }).png().toBuffer();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('.glb')
          ? new Response(new Uint8Array(glb), { headers: { 'content-type': 'application/octet-stream' } })
          : new Response(new Uint8Array(png), { headers: { 'content-type': 'image/png' } })
      )
    );
    gateway.task.mockResolvedValue({
      state: 'done',
      costUsd: 0.25,
      outputs: [
        { url: 'https://cdn.wiro.test/preview.png', contentType: 'image/png' },
        { url: 'https://cdn.wiro.test/model.glb', contentType: 'application/octet-stream' }
      ]
    });
    const { db, calls } = fakeDb({ node_runs: [queued], nodes: [model3dNode({ running: true, runId: RUN })], projects: [standardProject] });

    expect(await reconcileWiroNodeRuns(db)).toMatchObject({ done: 1 });

    const inserted = calls.filter((c) => c.table === 'assets' && c.op === 'insert').map((c) => c.payload as Record<string, unknown>);
    const model = inserted.find((a) => a.type === 'model3d')!;
    expect(model).toMatchObject({ mime_type: 'model/gltf-binary', ai_marked: true, source: 'generated', uncensored: false });
    expect(String(model.url)).toMatch(new RegExp(`^${USER}/media/wiro/.+\\.glb$`));
    expect(inserted.find((a) => a.type === 'image')).toMatchObject({ mime_type: 'image/png', ai_marked: true });

    const uploads = calls.filter((c) => c.op === 'upload').map((c) => c.payload as Blob);
    const stored = await Promise.all(uploads.map(async (b) => Buffer.from(await b.arrayBuffer())));
    const glbStored = stored.find((b) => b.toString('ascii', 0, 4) === 'glTF')!;
    expect(readGlbJson(glbStored).extensionsUsed).toContain('KHR_xmp_json_ld');

    expect(bill).toHaveBeenCalledWith(expect.objectContaining({ model: TRELLIS, costUsd: 0.25 }));
    const shown = calls.find((c) => c.table === 'nodes' && c.op === 'update' && JSON.stringify(c.payload).includes('posterRefId'));
    expect(shown).toBeTruthy();
  });

  it('fails the run when Wiro returns no GLB', async () => {
    gateway.task.mockResolvedValue({ state: 'done', costUsd: 0.25, outputs: [{ url: 'https://cdn.wiro.test/preview.png', contentType: 'image/png' }] });
    const { db } = fakeDb({ node_runs: [queued], nodes: [model3dNode({ running: true, runId: RUN })], projects: [standardProject] });

    expect(await reconcileWiroNodeRuns(db)).toMatchObject({ failed: 1 });
  });
});
