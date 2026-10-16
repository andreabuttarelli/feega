import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import type { Db } from '$lib/server/db/client';
import { reconcileTaskNodeRuns, runGenNode } from './generate';
import type { TaskModel, TaskRunDeps } from './task-run';
import type { ScreenPorts } from '$lib/server/moderation/screen';

const ORG = '11111111-1111-1111-1111-111111111111';
const NODE = '22222222-2222-2222-2222-222222222222';
const RUN = '33333333-3333-3333-3333-333333333333';
const PROJECT = '44444444-4444-4444-4444-444444444444';
const USER = '55555555-5555-5555-5555-555555555555';
const CANVAS = '66666666-6666-6666-6666-666666666666';
const INFLUENCER_NODE = '77777777-7777-7777-7777-777777777777';

const UNCENSORED = 'wiro/wiro-partners/z-image-uncensored';
const SAFE = 'wiro/alibaba/qwen-image-3-0-pro';

const REFERENCE_VIDEO = 'higgsfield/bytedance/seedance-2.5/reference-to-video';

const VIDEO_EDIT = 'higgsfield/bytedance/seedance-2.5/video-edit';

const models: Record<string, TaskModel> = {
  [VIDEO_EDIT]: {
    id: VIDEO_EDIT,
    catalogue: 'video',
    uncensored: false,
    spec: {
      path: 'bytedance/seedance-2.5/video-edit',
      numeric: ['duration'],
      fields: { prompt: 'prompt', resolution: 'resolution', images: [], video: 'video_url', imageList: 'image_urls', videoList: 'video_urls', audioList: 'audio_urls' },
      requiresVideo: true,
      caps: { image: 30, video: 9, audio: 10 }
    },
    paramSchema: {}
  },
  [REFERENCE_VIDEO]: {
    id: REFERENCE_VIDEO,
    catalogue: 'video',
    uncensored: false,
    spec: { path: 'bytedance/seedance-2.5/reference-to-video', fields: { prompt: 'prompt', images: [], imageList: 'image_urls', videoList: 'video_urls', audioList: 'audio_urls' } },
    paramSchema: {}
  },
  [UNCENSORED]: {
    id: UNCENSORED,
    catalogue: 'image',
    uncensored: true,
    spec: { owner: 'wiro-partners', project: 'z-image-uncensored', fields: { prompt: 'prompt', aspectRatio: 'ratio', images: [] } },
    paramSchema: { aspect_ratio: { type: 'enum', values: ['1:1'] }, promptExtend: { type: 'enum', values: ['false', 'true'] } }
  },
  [SAFE]: {
    id: SAFE,
    catalogue: 'image',
    uncensored: false,
    spec: { owner: 'alibaba', project: 'qwen-image-3-0-pro', fields: { prompt: 'prompt', images: ['inputImage'] } },
    paramSchema: {}
  }
};

const gateway = { run: vi.fn(), task: vi.fn(), purge: vi.fn(), quote: vi.fn() };
const bill = vi.fn();
const decide = vi.fn();
const judge = vi.fn();
const decideIdentifiability = vi.fn();
const judgeIdentifiability = vi.fn();
const record = vi.fn();
const screen: ScreenPorts = { decide, judge, decideIdentifiability, judgeIdentifiability, record };

const { deps, upstreamMedia, providerLoad } = vi.hoisted(() => ({
  deps: { current: null as null | ((db: Db) => TaskRunDeps) },
  upstreamMedia: { current: {} as Record<string, unknown> },
  providerLoad: { current: undefined as TaskRunDeps['load'] }
}));
vi.mock('$lib/server/task-providers-config', () => ({ taskRunDeps: (db: Db) => deps.current!(db) }));
vi.mock('$app/environment', () => ({ dev: true, browser: false, building: false }));
vi.mock('$env/dynamic/private', () => ({ env: { UNCENSORED_DEV_MANUAL_VERIFICATION: 'true' } }));
vi.mock('./node-model', () => ({ resolveModelIn: async (_mode: string, _m: string, model: string | null) => ({ ok: true, model }) }));
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
    rejected: [],
    ...upstreamMedia.current
  })
}));

beforeEach(async () => {
  for (const fn of [gateway.run, gateway.task, gateway.purge, gateway.quote, bill, decide, judge, decideIdentifiability, judgeIdentifiability, record]) {
    fn.mockReset();
  }
  decide.mockResolvedValue({ choice: 'safe', probabilities: { safe: 0.999 } });
  decideIdentifiability.mockResolvedValue({ choice: 'generic', probabilities: { generic: 0.999 } });
  judgeIdentifiability.mockResolvedValue({ allowed: true, category: 'generic', reason: '' });
  gateway.run.mockResolvedValue({ taskId: '2221' });
  upstreamMedia.current = {};
  providerLoad.current = undefined;
  const { uncensoredAccess } = await import('$lib/server/uncensored-access');
  deps.current = (db) => ({
    providers: { wiro: gateway, higgsfield: gateway },
    load: providerLoad.current,
    model: async (id) => models[id] ?? null,
    access: (orgId) => uncensoredAccess(db, orgId),
    screen: () => screen,
    refuseLikeness: (_scope, _model, reason) => record({ stage: 'rules', verdict: 'refuse', reason }),
    bill
  });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } })));
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

const start = (model: string, prompt: string, params: Record<string, unknown> = {}) => ({
  orgId: ORG,
  projectId: PROJECT,
  canvasId: CANVAS,
  nodeId: NODE,
  userId: USER,
  medium: 'image' as const,
  prompt,
  model,
  params,
  expectedVersion: 1
});

const paidOrg = { id: ORG, stripe_subscription_id: 'sub_1' };
const optIn = { org_id: ORG, enabled_by: USER, enabled_at: '2026-09-29T10:00:00Z', disabled_at: null };
const uncensoredProject = { id: PROJECT, org_id: ORG, mode: 'uncensored' };
const verified = { id: 'v1', user_id: USER, provider: 'manual_admin', method: 'manual_admin', result: 'adult' };

function canvas(extra: Record<string, unknown[]> = {}) {
  return fakeDb(
    {
      nodes: [imageNode()],
      nodes_connections: [],
      assets: [],
      orgs: [paidOrg],
      org_uncensored_optins: [optIn],
      projects: [uncensoredProject],
      user_age_verifications: [verified],
      ...extra
    },
    { updateRows: { nodes: [{ ...imageNode(), version: 2 }] } }
  );
}

const externalJobOf = (calls: ReturnType<typeof fakeDb>['calls']) =>
  (calls.find((c) => c.table === 'node_runs' && c.op === 'update' && (c.payload as Record<string, unknown>)?.external_job_id)?.payload as
    | Record<string, unknown>
    | undefined)?.external_job_id;

describe('an image node on a Wiro model', () => {
  it('is refused in a standard project, by project mode, before any provider call', async () => {
    const { db } = canvas({ projects: [{ ...uncensoredProject, mode: 'standard' }] });

    const out = await runGenNode(db, start(SAFE, 'a lighthouse'));

    expect(out).toEqual({ kind: 'refused', error: 'wiro_requires_uncensored_project' });
    expect(gateway.run).not.toHaveBeenCalled();
  });

  it('is refused in an uncensored project for a user without age verification', async () => {
    const { db } = canvas({ user_age_verifications: [] });

    const out = await runGenNode(db, start(SAFE, 'a lighthouse'));

    expect(out).toEqual({ kind: 'refused', error: 'uncensored_workspace_locked' });
    expect(gateway.run).not.toHaveBeenCalled();
  });

  it('keeps uncensored models off until the owner opted in', async () => {
    const { db } = canvas({ org_uncensored_optins: [] });

    const out = await runGenNode(db, start(UNCENSORED, 'a woman on a balcony'));

    expect(out).toEqual({ kind: 'refused', error: 'uncensored_workspace_locked' });
    expect(gateway.run).not.toHaveBeenCalled();
  });

  it('keeps uncensored models off on a free plan even after an opt-in', async () => {
    const { db } = canvas({ orgs: [{ id: ORG, stripe_subscription_id: null }] });
    expect(await runGenNode(db, start(UNCENSORED, 'x'))).toMatchObject({ kind: 'refused' });
    expect(gateway.run).not.toHaveBeenCalled();
  });

  it('after opt-in, screens the prompt and queues a Wiro task with mapped inputs', async () => {
    const { db, calls } = canvas();

    const out = await runGenNode(db, start(UNCENSORED, 'a woman on a balcony', { aspectRatio: '1:1', promptExtend: 'false' }));

    expect(out.kind).toBe('queued');
    expect(decide).toHaveBeenCalledOnce();
    expect(gateway.run).toHaveBeenCalledWith(
      { owner: 'wiro-partners', project: 'z-image-uncensored' },
      { prompt: 'a woman on a balcony', ratio: '1:1', promptExtend: 'false' },
      expect.any(String)
    );
    expect(externalJobOf(calls)).toBe('wiro:2221');
  });

  it('refuses minors on an uncensored model without calling Jev or Wiro', async () => {
    const { db } = canvas();
    expect(await runGenNode(db, start(UNCENSORED, 'nude teen'))).toMatchObject({ kind: 'refused' });
    expect(decide).not.toHaveBeenCalled();
    expect(gateway.run).not.toHaveBeenCalled();
  });

  it('refuses a real catalogue talent wired into an uncensored run, without calling Wiro', async () => {
    const { db } = fakeDb(
      {
        nodes: [imageNode(), { ...imageNode({ influencer_id: 'talent' }), id: INFLUENCER_NODE, type: 'influencer' }],
        nodes_connections: [
          { id: 'e1', org_id: ORG, canvas_id: CANVAS, source_node_id: INFLUENCER_NODE, target_node_id: NODE, source_handle: null, target_handle: null, mode: 'fixed' }
        ],
        influencers: [{ id: 'talent', org_id: null, source: 'catalogue', age: 26, adult_persona_at: null, name: 'Luna' }],
        assets: [],
        orgs: [paidOrg],
        org_uncensored_optins: [optIn],
        projects: [uncensoredProject],
        user_age_verifications: [verified]
      },
      { updateRows: { nodes: [{ ...imageNode(), version: 2 }] } }
    );

    const out = await runGenNode(db, start(UNCENSORED, 'lingerie editorial'));

    // Uncensored models take no input of any kind (CLAUDE.md, "No inputs for uncensored
    // models"): a wired node — real talent or not — is refused by that broader rule before the
    // likeness guard ever runs. The likeness guard (`likeness-guard.ts`) stays as defense in
    // depth for a crafted request that reaches `startTaskRun` without going through
    // `upstreamInputsFor` — see `task-run.test.ts`.
    expect(out).toMatchObject({ kind: 'refused', error: expect.stringMatching(/accept references/) });
    expect(gateway.run).not.toHaveBeenCalled();
  });

  it('asks the LLM judge on a standard Wiro model when the classifier is unavailable', async () => {
    decide.mockRejectedValue(new Error('jev_not_configured'));
    judge.mockResolvedValue({ allowed: true, category: 'safe', reason: 'landscape' });
    const { db } = canvas();
    expect((await runGenNode(db, start(SAFE, 'a mountain lake'))).kind).toBe('queued');
    expect(judge).toHaveBeenCalledOnce();
  });

  it('fails closed when both the classifier and the judge are unavailable', async () => {
    decide.mockRejectedValue(new Error('jev_not_configured'));
    judge.mockRejectedValue(new Error('judge down'));
    const { db } = canvas();
    expect(await runGenNode(db, start(SAFE, 'a mountain lake'))).toMatchObject({ kind: 'refused', error: expect.stringMatching(/moderation_unavailable/) });
    expect(gateway.run).not.toHaveBeenCalled();
  });

  it('runs a safe Wiro model in an open uncensored project, still screened', async () => {
    const { db } = canvas();
    expect((await runGenNode(db, start(SAFE, 'a mountain lake'))).kind).toBe('queued');
    expect(decide).toHaveBeenCalledOnce();
  });

  it('refuses even a safe Wiro model once the owner turned uncensored mode off', async () => {
    const { db } = canvas({ org_uncensored_optins: [] });
    expect(await runGenNode(db, start(SAFE, 'a mountain lake'))).toEqual({ kind: 'refused', error: 'uncensored_workspace_locked' });
  });
});

describe('the run tick finishes a Wiro task', () => {
  const queued = {
    id: RUN,
    org_id: ORG,
    node_id: NODE,
    prompt: 'x',
    model: UNCENSORED,
    params: {},
    status: 'running',
    error: null,
    output_asset_id: null,
    external_job_id: 'wiro:2221',
    cost_usd: null,
    attempts: 0,
    claimed_at: null,
    started_at: new Date().toISOString(),
    finished_at: null,
    actor_kind: 'user',
    actor_id: USER
  };

  it('leaves a running task for the next tick', async () => {
    gateway.task.mockResolvedValue({ state: 'pending' });
    const { db } = fakeDb({ node_runs: [queued], nodes: [imageNode({ running: true, runId: RUN })] });

    expect(await reconcileTaskNodeRuns(db)).toMatchObject({ checked: 1, pending: 1 });
  });

  it('stores the output as a flagged asset, bills the real cost and marks the node', async () => {
    gateway.task.mockResolvedValue({ state: 'done', costUsd: 0.013, outputs: [{ url: 'https://cdn.wiro.test/0.png', contentType: 'image/png' }] });
    const { db, calls } = fakeDb({ node_runs: [queued], nodes: [imageNode({ running: true, runId: RUN })], projects: [uncensoredProject] });

    expect(await reconcileTaskNodeRuns(db)).toMatchObject({ done: 1 });

    expect(gateway.task).toHaveBeenCalledWith('2221');
    const asset = calls.find((c) => c.table === 'assets' && c.op === 'insert')?.payload as Record<string, unknown>;
    expect(asset).toMatchObject({ type: 'image', uncensored: true, source: 'generated' });
    expect(String(asset.url)).toMatch(new RegExp(`^${USER}/uncensored/wiro/.+\\.png$`));
    expect(bill).toHaveBeenCalledWith(expect.objectContaining({ costUsd: 0.013, uncensored: true }));
    expect(gateway.purge).not.toHaveBeenCalled();
    const shown = calls.find((c) => c.table === 'nodes' && c.op === 'update' && JSON.stringify(c.payload).includes('outputUncensored'));
    expect(shown).toBeTruthy();
  });

  it('stores a Wiro png marked with the Wiro model, and records it', async () => {
    const sharp = (await import('sharp')).default;
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#000' } }).png().toBuffer();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(png), { headers: { 'content-type': 'image/png' } })));
    gateway.task.mockResolvedValue({ state: 'done', costUsd: 0.013, outputs: [{ url: 'https://cdn.wiro.test/0.png', contentType: 'image/png' }] });
    const { db, calls } = fakeDb({ node_runs: [queued], nodes: [imageNode({ running: true, runId: RUN })], projects: [uncensoredProject] });

    await reconcileTaskNodeRuns(db);

    const asset = calls.find((c) => c.table === 'assets' && c.op === 'insert')?.payload as Record<string, unknown>;
    expect(asset.ai_marked).toBe(true);
    const upload = calls.find((c) => c.op === 'upload')?.payload as Blob;
    const xmp = (await sharp(Buffer.from(await upload.arrayBuffer())).metadata()).xmp?.toString();
    expect(xmp).toContain(`wiro/${UNCENSORED}`);
  });

  it('fails the run with the Wiro reason', async () => {
    gateway.task.mockResolvedValue({ state: 'failed', error: 'wiro_task_failed: exit 1' });
    const { db, calls } = fakeDb({ node_runs: [queued], nodes: [imageNode({ running: true, runId: RUN })] });

    expect(await reconcileTaskNodeRuns(db)).toMatchObject({ failed: 1 });
    const failed = calls.find((c) => c.table === 'node_runs' && c.op === 'update' && (c.payload as Record<string, unknown>)?.status === 'failed');
    expect((failed?.payload as Record<string, unknown>).error).toBe('wiro_task_failed: exit 1');
  });
});

describe('taskPurgers', () => {
  it('deletes a task at Wiro by its own task id', async () => {
    const { taskPurgers } = await import('./task-run');
    gateway.purge.mockResolvedValue('purged');

    expect(await taskPurgers({ wiro: gateway })['wiro:']('wiro:2221')).toBe('purged');
    expect(gateway.purge).toHaveBeenCalledWith('2221');
  });
});

describe('a video node on a model that takes video and audio references', () => {
  it('sends the connected videos and audios, signed, to the provider', async () => {
    upstreamMedia.current = { referenceVideoUrls: ['https://cdn.test/clip.mp4'], referenceAudioUrls: ['https://cdn.test/voice.wav'] };
    const { db } = fakeDb(
      { nodes: [{ ...imageNode(), type: 'video' }], nodes_connections: [], assets: [], orgs: [paidOrg], projects: [{ id: PROJECT, org_id: ORG, mode: 'standard' }] },
      { updateRows: { nodes: [{ ...imageNode(), type: 'video', version: 2 }] } }
    );

    const out = await runGenNode(db, { ...start(REFERENCE_VIDEO, 'dance'), medium: 'video' });

    expect(out.kind).toBe('queued');
    expect(gateway.run).toHaveBeenCalledWith(
      { path: 'bytedance/seedance-2.5/reference-to-video' },
      expect.objectContaining({ video_urls: ['https://cdn.test/clip.mp4'], audio_urls: ['https://cdn.test/voice.wav'] }),
      expect.any(String)
    );
  });
});

describe('a Higgsfield run when the account is at its concurrency cap', () => {
  const videoCanvas = (extra: Record<string, unknown[]> = {}) =>
    fakeDb(
      { nodes: [{ ...imageNode({ running: true, runId: RUN }), type: 'video' }], nodes_connections: [], assets: [], orgs: [paidOrg], projects: [{ id: PROJECT, org_id: ORG, mode: 'standard' }], ...extra },
      { updateRows: { nodes: [{ ...imageNode(), type: 'video', version: 2 }] } }
    );

  it('queues locally instead of failing, and the node keeps running', async () => {
    providerLoad.current = async () => ({ inFlight: 4, waiting: 0, cap: 4 });
    const { db, calls } = videoCanvas();

    const out = await runGenNode(db, { ...start(REFERENCE_VIDEO, 'dance'), medium: 'video' });

    expect(out.kind).toBe('queued');
    expect(gateway.run).not.toHaveBeenCalled();
    expect(externalJobOf(calls)).toBe('higgsfield:waiting');
  });

  const waitingRun = {
    id: RUN,
    org_id: ORG,
    node_id: NODE,
    prompt: 'dance',
    model: REFERENCE_VIDEO,
    params: {},
    status: 'running',
    error: null,
    output_asset_id: null,
    external_job_id: 'higgsfield:waiting',
    cost_usd: null,
    attempts: 0,
    started_at: new Date().toISOString(),
    finished_at: null,
    actor_id: USER
  };

  it('submits a waiting run once a slot frees, never polling the placeholder', async () => {
    providerLoad.current = async () => ({ inFlight: 3, waiting: 1, cap: 4 });
    upstreamMedia.current = { referenceVideoUrls: ['https://cdn.test/clip.mp4'] };
    const { db, calls } = videoCanvas({ node_runs: [waitingRun] });

    expect(await reconcileTaskNodeRuns(db)).toMatchObject({ checked: 1, pending: 1 });

    expect(gateway.task).not.toHaveBeenCalled();
    expect(gateway.run).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ prompt: 'dance', video_urls: ['https://cdn.test/clip.mp4'] }), RUN);
    expect(externalJobOf(calls)).toBe('higgsfield:2221');
  });

  it('leaves a waiting run waiting while the account stays full', async () => {
    providerLoad.current = async () => ({ inFlight: 4, waiting: 1, cap: 4 });
    const { db } = videoCanvas({ node_runs: [waitingRun] });

    expect(await reconcileTaskNodeRuns(db)).toMatchObject({ checked: 1, pending: 1 });
    expect(gateway.run).not.toHaveBeenCalled();
    expect(gateway.task).not.toHaveBeenCalled();
  });
});

describe('a video node editing a wired video with Seedance 2.5', () => {
  const editCanvas = () =>
    fakeDb(
      { nodes: [{ ...imageNode(), type: 'video' }], nodes_connections: [], assets: [], orgs: [paidOrg], projects: [{ id: PROJECT, org_id: ORG, mode: 'standard' }] },
      { updateRows: { nodes: [{ ...imageNode(), type: 'video', version: 2 }] } }
    );

  it('sends the first wired video as the source, the others as references, at the chosen resolution', async () => {
    upstreamMedia.current = { referenceVideoUrls: ['https://cdn.test/source.mp4', 'https://cdn.test/style.mp4'] };
    const { db } = editCanvas();

    const out = await runGenNode(db, { ...start(VIDEO_EDIT, 'make it night', { resolution: '1080p' }), medium: 'video' });

    expect(out.kind).toBe('queued');
    expect(gateway.run).toHaveBeenCalledWith(
      { path: 'bytedance/seedance-2.5/video-edit', numeric: ['duration'] },
      { prompt: 'make it night', resolution: '1080p', video_url: 'https://cdn.test/source.mp4', video_urls: ['https://cdn.test/style.mp4'] },
      expect.any(String)
    );
  });

  it('refuses without a wired video, before any provider call', async () => {
    const { db } = editCanvas();

    const out = await runGenNode(db, { ...start(VIDEO_EDIT, 'make it night'), medium: 'video' });

    expect(out).toEqual({ kind: 'refused', error: 'missing_input: this model needs a source video' });
    expect(gateway.run).not.toHaveBeenCalled();
  });
});

describe('a run quoted on submit', () => {
  it('stores the provider quote on the run, so the finished task bills that price', async () => {
    models[VIDEO_EDIT].spec.quotedAtSubmit = true;
    gateway.quote.mockResolvedValue(8.2);
    upstreamMedia.current = { referenceVideoUrls: ['https://cdn.test/source.mp4'] };
    const { db, calls } = fakeDb(
      { nodes: [{ ...imageNode(), type: 'video' }], nodes_connections: [], assets: [], orgs: [paidOrg], projects: [{ id: PROJECT, org_id: ORG, mode: 'standard' }] },
      { updateRows: { nodes: [{ ...imageNode(), type: 'video', version: 2 }] } }
    );

    await runGenNode(db, { ...start(VIDEO_EDIT, 'restyle', { resolution: '720p' }), medium: 'video' });
    models[VIDEO_EDIT].spec.quotedAtSubmit = false;

    const stored = calls.find((c) => c.table === 'node_runs' && c.op === 'update' && (c.payload as { params?: Record<string, unknown> }).params?.quotedUsd);
    expect((stored?.payload as { params: Record<string, unknown> }).params).toEqual({ resolution: '720p', quotedUsd: 8.2 });
  });
});

