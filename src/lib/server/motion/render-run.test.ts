import { beforeEach, describe, expect, it, vi } from 'vitest';

const runs = vi.hoisted(() => ({
  createRun: vi.fn(),
  claimRun: vi.fn(),
  completeRun: vi.fn(),
  failRun: vi.fn(),
  listNodeRuns: vi.fn(),
  setRunParams: vi.fn()
}));
const saveExport = vi.hoisted(() => vi.fn());
const logAiCall = vi.hoisted(() => vi.fn());
const sendPushToUser = vi.hoisted(() => vi.fn());
const renderOnFarm = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/repos/node-runs', () => ({ ...runs, RENDER_JOB_PREFIX: 'motion-render:' }));
vi.mock('./export', () => ({ saveExport }));
vi.mock('$lib/server/ai-log', () => ({ logAiCall }));
vi.mock('$lib/server/web-push', () => ({ sendPushToUser }));
vi.mock('$lib/server/background-work', () => ({ runInBackground: (work: () => Promise<unknown>) => void work() }));
vi.mock('./farm-render', () => ({ renderOnFarm, RenderFailure: class extends Error {} }));

import { farmJob, finishRender, RenderRefusal, renderView, startRender, type RenderRequest } from './render-run';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { RenderStage } from '$lib/motion/server-render';
import { addClip } from '$lib/motion/timeline';
import { writeComponent } from '$lib/motion/custom/ops';
import type { NodeRun } from '$lib/server/repos/node-runs';

const farm = { open: vi.fn() };
const scope = { orgId: 'org', projectId: 'prj', nodeId: 'node', userId: 'u', editorUrl: '/p/prj/c/c/motion/node' };

function trailer(): MotionDoc {
  return { ...newMotionDoc(MotionFormat.Landscape), durationInFrames: 840 };
}

function request(doc = trailer()): RenderRequest {
  return { version: 12, doc, job: { html: '<html/>', width: doc.width, height: doc.height, fps: doc.fps, totalFrames: doc.durationInFrames, audio: [], allowHosts: [] } };
}

function runOf(params: Record<string, unknown>): NodeRun {
  return { id: 'run-1', orgId: 'org', nodeId: 'node', prompt: null, model: null, params, status: 'running', error: null, outputAssetId: null, externalJobId: 'motion-render:12', costUsd: null, attempts: 0, actorId: 'u', startedAt: '', finishedAt: null };
}

function fakeDb() {
  const uploads: string[] = [];
  const db = { storage: { from: () => ({ upload: async (path: string) => (uploads.push(path), { error: null }) }) } };
  return { db: db as never, uploads };
}

function lastProgress() {
  const calls = runs.setRunParams.mock.calls;
  return calls.at(-1)?.[1].params.progress;
}

beforeEach(() => {
  vi.clearAllMocks();
  runs.listNodeRuns.mockResolvedValue([]);
  runs.createRun.mockImplementation(async (_db, input) => runOf(input.params));
  runs.claimRun.mockImplementation(async () => runOf({}));
  saveExport.mockResolvedValue({ ok: true, assetId: 'asset-9' });
  sendPushToUser.mockResolvedValue({ sent: 0, pruned: 0 });
  renderOnFarm.mockImplementation(async (_farm, _job, onEvent) => {
    onEvent({ kind: 'chunk' });
    onEvent({ kind: 'assembling' });
    return Buffer.from('mp4');
  });
});

describe('startRender refuses before spending anything', () => {
  it('without a render farm', async () => {
    const { db } = fakeDb();

    expect(await startRender(db, null, scope, request())).toEqual({ ok: false, error: RenderRefusal.NotConfigured });
    expect(runs.createRun).not.toHaveBeenCalled();
  });

  it('a doc whose custom component has not passed the seek check', async () => {
    const draft = { source: { html: '<i></i>', css: '', js: '' }, propsSchema: { type: 'object' as const, properties: {} } };
    const written = writeComponent(trailer(), 'Glow', draft);
    const used = written.ok ? addClip(written.doc, { component: 'Custom', from: 0, durationInFrames: 30, props: { name: 'Glow' } }, 'g1') : written;
    const doc = (used as { doc: MotionDoc }).doc;
    const { db } = fakeDb();

    expect(await startRender(db, farm, scope, request(doc))).toEqual({ ok: false, error: RenderRefusal.Unverified });
    expect(runs.createRun).not.toHaveBeenCalled();
  });

  it('a second render while one is running on the same node', async () => {
    runs.listNodeRuns.mockResolvedValue([runOf({}), { ...runOf({}), id: 'old', status: 'done' }]);
    const { db } = fakeDb();

    expect(await startRender(db, farm, scope, request())).toEqual({ ok: false, error: RenderRefusal.Busy });
  });
});

describe('startRender', () => {
  it('records the revision, the format and the quote on a run the tick can find', async () => {
    const { db } = fakeDb();

    const started = await startRender(db, farm, scope, request());

    expect(started).toEqual({ ok: true, runId: 'run-1', quote: { seconds: 28, resolution: '1080p', credits: 6 } });
    expect(runs.createRun).toHaveBeenCalledWith(db, expect.objectContaining({
      orgId: 'org',
      nodeId: 'node',
      externalJobId: 'motion-render:12',
      actorId: 'u',
      params: expect.objectContaining({ revision: 12, format: '16:9', quote: { seconds: 28, resolution: '1080p', credits: 6 }, progress: { stage: RenderStage.Starting, chunksDone: 0, chunks: 7, totalFrames: 840 } })
    }));
  });
});

describe('finishRender', () => {
  const run = runOf({ revision: 12, quote: { seconds: 28, resolution: '1080p', credits: 6 }, progress: { stage: RenderStage.Starting, chunksDone: 0, chunks: 7, totalFrames: 840 } });

  it('stores the file in the node export folder, attaches it, charges the quote once and says it is done', async () => {
    const { db, uploads } = fakeDb();

    await finishRender(db, farm, scope, run, request());

    expect(uploads).toEqual(['org/prj/motion/node/run-1.mp4']);
    expect(saveExport).toHaveBeenCalledWith(db, expect.objectContaining({ path: 'org/prj/motion/node/run-1.mp4', width: 1920, height: 1080, seconds: 28, nodeId: 'node' }));
    expect(logAiCall).toHaveBeenCalledTimes(1);
    expect(logAiCall.mock.calls[0][0]).toMatchObject({ label: 'motion_render', ok: true, flatCostUsd: 0.03, orgId: 'org', actorId: 'u' });
    expect(runs.completeRun).toHaveBeenCalledWith(db, expect.objectContaining({ runId: 'run-1', assetId: 'asset-9' }));
    expect(lastProgress()).toMatchObject({ stage: RenderStage.Done, chunksDone: 1 });
    expect(sendPushToUser).toHaveBeenCalledWith(db, 'u', expect.objectContaining({ url: scope.editorUrl }));
  });

  it('a farm failure closes the run with its reason and charges nothing', async () => {
    renderOnFarm.mockRejectedValue(new Error('chunk 3 failed: chrome crashed'));
    const { db, uploads } = fakeDb();

    await finishRender(db, farm, scope, run, request());

    expect(runs.failRun).toHaveBeenCalledWith(db, { orgId: 'org', runId: 'run-1', error: 'chunk 3 failed: chrome crashed' });
    expect(lastProgress()?.stage).toBe(RenderStage.Failed);
    expect(uploads).toEqual([]);
    expect(logAiCall).not.toHaveBeenCalled();
  });

  it('a run the sweep already expired is not saved or charged', async () => {
    runs.claimRun.mockResolvedValue(null);
    const { db, uploads } = fakeDb();

    await finishRender(db, farm, scope, run, request());

    expect(uploads).toEqual([]);
    expect(logAiCall).not.toHaveBeenCalled();
  });

  it('a file that cannot be saved fails the run and charges nothing', async () => {
    saveExport.mockResolvedValue({ ok: false, error: 'file_not_found' });
    const { db } = fakeDb();

    await finishRender(db, farm, scope, run, request());

    expect(runs.failRun).toHaveBeenCalledWith(db, expect.objectContaining({ error: 'file_not_found' }));
    expect(logAiCall).not.toHaveBeenCalled();
    expect(runs.completeRun).not.toHaveBeenCalled();
  });
});

describe('farmJob', () => {
  it('the sandbox may reach the hosts of the signed assets and of the brand logo, nothing else', () => {
    const tokens = { ...FEEGA_TOKENS, logoUrl: 'https://media.example.com/logo.png' };
    const job = farmJob({ doc: trailer(), tokens, assets: { a: 'https://x.supabase.co/storage/v1/object/sign/a?token=t', b: 'https://x.supabase.co/b' } });

    expect(job.allowHosts).toEqual(['media.example.com', 'x.supabase.co']);
    expect([job.width, job.height, job.fps, job.totalFrames]).toEqual([1920, 1080, 30, 840]);
    expect(job.html).toContain('<html');
  });
});

describe('what the export dialog sees of a render', () => {
  it('the newest render run of the node, with its progress, outcome and price', () => {
    const progress = { stage: RenderStage.Done, chunksDone: 7, chunks: 7, totalFrames: 840 };
    const old = { ...runOf({ progress }), id: 'old', status: 'failed' as const, error: 'boom' };
    const last = { ...runOf({ progress, quote: { credits: 6 } }), status: 'done' as const, outputAssetId: 'asset-9' };
    const video = { ...runOf({}), id: 'clip', externalJobId: 'kling:1' };

    expect(renderView([old, last, video])).toEqual({ id: 'run-1', status: 'done', progress, error: null, assetId: 'asset-9', credits: 6 });
  });

  it('no render yet is nothing to show', () => {
    expect(renderView([])).toBeNull();
  });
});
