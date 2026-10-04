import { beforeEach, describe, expect, it, vi } from 'vitest';

const runs = vi.hoisted(() => ({
  createRun: vi.fn(),
  claimRun: vi.fn(),
  releaseClaim: vi.fn(),
  completeRun: vi.fn(),
  failRun: vi.fn(),
  listNodeRuns: vi.fn(),
  queuedRenderRuns: vi.fn(),
  setRunParams: vi.fn()
}));
const saveExport = vi.hoisted(() => vi.fn());
const logAiCall = vi.hoisted(() => vi.fn());
const sendPushToUser = vi.hoisted(() => vi.fn());
const farmCalls = vi.hoisted(() => ({ launchPiece: vi.fn(), launchAssembly: vi.fn(), checkTask: vi.fn(), stopWorker: vi.fn() }));

vi.mock('$lib/server/repos/node-runs', () => ({ ...runs, RENDER_JOB_PREFIX: 'motion-render:' }));
vi.mock('./export', () => ({ saveExport }));
vi.mock('$lib/server/ai-log', () => ({ logAiCall }));
vi.mock('$lib/server/web-push', () => ({ sendPushToUser }));
vi.mock('./farm-render', async (original) => ({ ...(await original<typeof import('./farm-render')>()), ...farmCalls }));

import { cancelRender, farmJob, reconcileRenders, RenderRefusal, renderRequest, renderView, startRender, type RenderRequest } from './render-run';
import { TaskState } from './farm-render';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { RenderStage } from '$lib/motion/server-render';
import { Resolution } from '$lib/motion/render-quote';
import { addClip } from '$lib/motion/timeline';
import { writeComponent } from '$lib/motion/custom/ops';
import type { NodeRun } from '$lib/server/repos/node-runs';
import { ExportFormat, Preset, settingsOf } from '$lib/motion/export-formats';

const farm = { open: vi.fn(), attach: vi.fn() };
const scope = { orgId: 'org', projectId: 'prj', nodeId: 'node', userId: 'u', editorUrl: '/p/prj/c/c/motion/node' };
const LIMIT = 50 * 1024 * 1024;
const storage = { host: 's.supabase.co', limit: vi.fn(async () => LIMIT) };
const done = { state: TaskState.Done, error: null };
const running = { state: TaskState.Running, error: null };

function trailer(): MotionDoc {
  return { ...newMotionDoc(MotionFormat.Landscape), durationInFrames: 840 };
}

function request(doc = trailer(), settings = settingsOf(Preset.Social)): RenderRequest {
  return { version: 12, doc, settings, job: { html: '<html/>', width: doc.width, height: doc.height, fps: doc.fps, totalFrames: doc.durationInFrames, audio: [], allowHosts: [], format: settings.format, quality: settings.quality, motionBlur: null } };
}

function runOf(params: Record<string, unknown>): NodeRun {
  return { id: 'run-1', orgId: 'org', nodeId: 'node', prompt: null, model: null, params, status: 'running', error: null, outputAssetId: null, externalJobId: 'motion-render:12', costUsd: null, attempts: 0, actorId: 'u', startedAt: new Date().toISOString(), finishedAt: null };
}

function fakeDb(job = request().job) {
  const uploads: string[] = [];
  const removed: string[] = [];
  const bucket = {
    upload: async (path: string) => (uploads.push(path), { error: null }),
    download: async () => ({ data: new Blob([JSON.stringify(job)]), error: null }),
    createSignedUploadUrl: async (path: string) => ({ data: { signedUrl: `https://s.supabase.co/up/${path}` }, error: null }),
    createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://s.supabase.co/get/${path}` }, error: null }),
    remove: async (paths: string[]) => (removed.push(...paths), { error: null })
  };
  const db = { storage: { from: () => bucket } };
  return { db: db as never, uploads, removed };
}

const lastParams = () => runs.setRunParams.mock.calls.at(-1)?.[1].params;

async function started(req = request()) {
  const { db } = fakeDb(req.job);
  await startRender(db, farm, scope, req, storage);
  const params = lastParams();
  return runOf(params);
}

beforeEach(() => {
  vi.clearAllMocks();
  runs.listNodeRuns.mockResolvedValue([]);
  runs.createRun.mockImplementation(async (_db, input) => runOf(input.params));
  runs.claimRun.mockImplementation(async (_db, input) => ({ ...runOf({}), id: input.runId }));
  saveExport.mockResolvedValue({ ok: true, assetId: 'asset-9' });
  sendPushToUser.mockResolvedValue({ sent: 0, pruned: 0 });
  let n = 0;
  farmCalls.launchPiece.mockImplementation(async () => `box-${n++}`);
  farmCalls.checkTask.mockResolvedValue(running);
});

describe('startRender refuses before spending anything', () => {
  it('without a render farm', async () => {
    const { db } = fakeDb();

    expect(await startRender(db, null, scope, request(), storage)).toEqual({ ok: false, error: RenderRefusal.NotConfigured });
    expect(runs.createRun).not.toHaveBeenCalled();
  });

  it('a doc whose custom component has not passed the seek check', async () => {
    const draft = { source: { html: '<i></i>', css: '', js: '' }, propsSchema: { type: 'object' as const, properties: {} } };
    const written = writeComponent(trailer(), 'Glow', draft);
    const used = written.ok ? addClip(written.doc, { component: 'Custom', from: 0, durationInFrames: 30, props: { name: 'Glow' } }, 'g1') : written;
    const doc = (used as { doc: MotionDoc }).doc;
    const { db } = fakeDb();

    expect(await startRender(db, farm, scope, request(doc), storage)).toEqual({ ok: false, error: RenderRefusal.Unverified });
    expect(runs.createRun).not.toHaveBeenCalled();
  });

  it('a second render while one is running on the same node', async () => {
    runs.listNodeRuns.mockResolvedValue([runOf({}), { ...runOf({}), id: 'old', status: 'done' }]);
    const { db } = fakeDb();

    expect(await startRender(db, farm, scope, request(), storage)).toEqual({ ok: false, error: RenderRefusal.Busy });
  });
});

describe('startRender only enqueues and starts the workers', () => {
  it('records the revision, the format and the quote on a run the tick can find', async () => {
    const { db } = fakeDb();

    const result = await startRender(db, farm, scope, request(), storage);

    expect(result).toEqual({ ok: true, runId: 'run-1', quote: { seconds: 28, resolution: '1080p', credits: 6 } });
    expect(runs.createRun).toHaveBeenCalledWith(db, expect.objectContaining({
      externalJobId: 'motion-render:12',
      actorId: 'u',
      params: expect.objectContaining({ revision: 12, format: '16:9', quote: { seconds: 28, resolution: '1080p', credits: 6 } })
    }));
  });

  it('stores the job for retries and starts one detached worker per chunk, each but the first with its own upload URL', async () => {
    const { db, uploads } = fakeDb();

    await startRender(db, farm, scope, request(), storage);

    expect(uploads).toEqual(['org/prj/motion/node/work/run-1/job.json']);
    expect(farmCalls.launchPiece).toHaveBeenCalledTimes(7);
    expect(farmCalls.launchPiece.mock.calls[0][3]).toEqual({ upload: null, storageHost: 's.supabase.co' });
    expect(farmCalls.launchPiece.mock.calls[2][3]).toEqual({ upload: 'https://s.supabase.co/up/org/prj/motion/node/work/run-1/c2.mp4', storageHost: 's.supabase.co' });
    expect(lastParams().farm.pieces.map((p: { worker: string }) => p.worker)).toEqual(['box-0', 'box-1', 'box-2', 'box-3', 'box-4', 'box-5', 'box-6']);
    expect(lastParams().progress).toMatchObject({ stage: RenderStage.Rendering, chunksDone: 0, chunks: 7 });
    expect(saveExport).not.toHaveBeenCalled();
  });

  it('a worker that cannot start fails the run, stops the ones that did and charges nothing', async () => {
    farmCalls.launchPiece.mockResolvedValueOnce('box-0').mockRejectedValueOnce(new Error('quota'));
    const { db } = fakeDb();

    const result = await startRender(db, farm, scope, request(), storage);

    expect(result).toMatchObject({ ok: false, error: RenderRefusal.Unavailable, detail: expect.stringContaining('quota') });
    expect(runs.failRun).toHaveBeenCalledWith(db, expect.objectContaining({ runId: 'run-1' }));
    expect(farmCalls.stopWorker).toHaveBeenCalledWith(farm, 'box-0');
    expect(logAiCall).not.toHaveBeenCalled();
  });
});

describe('reconcileRenders', () => {
  it('a render still working is left running, and the tick releases its claim', async () => {
    const run = await started();
    runs.queuedRenderRuns.mockResolvedValue([run]);
    const { db } = fakeDb();

    await reconcileRenders(db, farm, storage);

    expect(runs.releaseClaim).toHaveBeenCalledWith(db, { orgId: 'org', runId: 'run-1' });
    expect(farmCalls.launchAssembly).not.toHaveBeenCalled();
  });

  it('a finished chunk stops its worker and counts as progress; the first worker is kept for assembly', async () => {
    const run = await started();
    runs.queuedRenderRuns.mockResolvedValue([run]);
    farmCalls.checkTask.mockImplementation(async (_f, name: string) => (['box-0', 'box-1'].includes(name) ? done : running));
    const { db } = fakeDb();

    await reconcileRenders(db, farm, storage);

    expect(farmCalls.stopWorker.mock.calls.map((c) => c[1])).toEqual(['box-1']);
    expect(lastParams().progress).toMatchObject({ stage: RenderStage.Rendering, chunksDone: 2 });
  });

  it('when every chunk is in, the first worker assembles from signed links and uploads to the export path', async () => {
    const run = await started();
    runs.queuedRenderRuns.mockResolvedValue([run]);
    farmCalls.checkTask.mockResolvedValue(done);
    const { db } = fakeDb();

    await reconcileRenders(db, farm, storage);

    const [, head, , links] = farmCalls.launchAssembly.mock.calls[0];
    expect(head).toBe('box-0');
    expect(links.pieces).toHaveLength(6);
    expect(links.pieces[0]).toBe('https://s.supabase.co/get/org/prj/motion/node/work/run-1/c1.mp4');
    expect(links.output).toBe('https://s.supabase.co/up/org/prj/motion/node/run-1.mp4');
    expect(links.maxBytes).toBe(LIMIT);
    expect(lastParams().progress.stage).toBe(RenderStage.Assembling);
  });

  it('a failed chunk is retried on a new worker, and fails the render once its attempts are spent', async () => {
    let run = await started();
    runs.queuedRenderRuns.mockImplementation(async () => [run]);
    farmCalls.checkTask.mockImplementation(async (_f, name: string) => (name === 'box-3' || name === 'box-7' ? { state: TaskState.Failed, error: 'chunk 3 failed: chrome crashed' } : running));
    const { db } = fakeDb();

    await reconcileRenders(db, farm, storage);
    expect(farmCalls.launchPiece).toHaveBeenLastCalledWith(farm, expect.anything(), 3, expect.objectContaining({ upload: expect.stringContaining('c3.mp4') }));
    expect(lastParams().farm.pieces[3]).toMatchObject({ worker: 'box-7', attempt: 2 });
    expect(runs.failRun).not.toHaveBeenCalled();

    run = runOf(lastParams());
    await reconcileRenders(db, farm, storage);
    expect(runs.failRun).toHaveBeenCalledWith(db, { orgId: 'org', runId: 'run-1', error: 'chunk 3 failed: chrome crashed' });
    expect(lastParams().progress.stage).toBe(RenderStage.Failed);
    expect(logAiCall).not.toHaveBeenCalled();
  });

  it('an assembled file is saved, attached, charged once, announced, and the work is cleaned up', async () => {
    let run = await started();
    runs.queuedRenderRuns.mockImplementation(async () => [run]);
    farmCalls.checkTask.mockResolvedValue(done);
    const { db, removed } = fakeDb();
    await reconcileRenders(db, farm, storage);
    run = runOf(lastParams());

    await reconcileRenders(db, farm, storage);

    expect(saveExport).toHaveBeenCalledWith(db, expect.objectContaining({ path: 'org/prj/motion/node/run-1.mp4', width: 1920, height: 1080, seconds: 28, nodeId: 'node', format: ExportFormat.Mp4H264 }));
    expect(logAiCall).toHaveBeenCalledTimes(1);
    expect(logAiCall.mock.calls[0][0]).toMatchObject({ label: 'motion_render', ok: true, flatCostUsd: 0.03, orgId: 'org', actorId: 'u' });
    expect(runs.completeRun).toHaveBeenCalledWith(db, expect.objectContaining({ runId: 'run-1', assetId: 'asset-9' }));
    expect(lastParams().progress.stage).toBe(RenderStage.Done);
    expect(sendPushToUser).toHaveBeenCalledWith(db, 'u', expect.objectContaining({ url: scope.editorUrl }));
    expect(removed).toEqual(expect.arrayContaining(['org/prj/motion/node/work/run-1/job.json', 'org/prj/motion/node/work/run-1/c1.mp4']));
    expect(farmCalls.stopWorker).toHaveBeenCalledWith(farm, 'box-0');
  });

  it('a file over the storage limit fails with its size and charges nothing', async () => {
    let run = await started(request(trailer(), settingsOf(Preset.Master)));
    runs.queuedRenderRuns.mockImplementation(async () => [run]);
    farmCalls.checkTask.mockResolvedValue(done);
    const { db } = fakeDb();
    await reconcileRenders(db, farm, storage);
    run = runOf(lastParams());
    farmCalls.checkTask.mockResolvedValue({ state: TaskState.Failed, error: 'size check failed: too_large: the file is 812 MB, over the 50 MB this project\'s storage accepts per file. Nothing was charged.' });

    await reconcileRenders(db, farm, storage);

    expect(runs.failRun).toHaveBeenCalledWith(db, expect.objectContaining({ error: expect.stringMatching(/^too_large: the file is 812 MB/) }));
    expect(farmCalls.launchAssembly).toHaveBeenCalledTimes(1);
    expect(logAiCall).not.toHaveBeenCalled();
  });

  it('a run another tick holds is left alone', async () => {
    const run = await started();
    runs.queuedRenderRuns.mockResolvedValue([run]);
    runs.claimRun.mockResolvedValue(null);
    const { db } = fakeDb();

    await reconcileRenders(db, farm, storage);

    expect(farmCalls.checkTask).not.toHaveBeenCalled();
  });
});

describe('cancelRender', () => {
  it('closes the running render as cancelled, stops its workers and charges nothing', async () => {
    const run = await started();
    runs.listNodeRuns.mockResolvedValue([run]);
    const { db } = fakeDb();

    expect(await cancelRender(db, farm, scope)).toEqual({ ok: true });

    expect(runs.failRun).toHaveBeenCalledWith(db, { orgId: 'org', runId: 'run-1', error: 'cancelled' });
    expect(farmCalls.stopWorker).toHaveBeenCalledTimes(7);
    expect(logAiCall).not.toHaveBeenCalled();
  });

  it('nothing running is nothing to cancel', async () => {
    const { db } = fakeDb();

    expect(await cancelRender(db, farm, scope)).toEqual({ ok: false });
  });
});

describe('farmJob', () => {
  it('the sandbox may reach the hosts of the signed assets and of the brand logo, nothing else', () => {
    const tokens = { ...FEEGA_TOKENS, logoUrl: 'https://media.example.com/logo.png' };
    const job = farmJob({ doc: trailer(), tokens, assets: { a: 'https://x.supabase.co/storage/v1/object/sign/a?token=t', b: 'https://x.supabase.co/b' } }, settingsOf(Preset.Social));

    expect(job.allowHosts).toEqual(['media.example.com', 'x.supabase.co']);
    expect([job.width, job.height, job.fps, job.totalFrames]).toEqual([1920, 1080, 30, 840]);
    expect(job.html).toContain('<html');
  });
});

describe('render settings', () => {
  it('a GIF over its length cap is refused before a run is created, with the reason', async () => {
    const { db } = fakeDb();

    const result = await startRender(db, farm, scope, request(trailer(), settingsOf(Preset.Gif)), storage);

    expect(result).toMatchObject({ ok: false, error: RenderRefusal.Unsupported, detail: expect.stringMatching(/GIF/) });
    expect(runs.createRun).not.toHaveBeenCalled();
  });

  it('the run records the settings it renders with', async () => {
    const { db } = fakeDb();
    const web = settingsOf(Preset.Web);

    await startRender(db, farm, scope, request(trailer(), web), storage);

    expect(runs.createRun).toHaveBeenCalledWith(db, expect.objectContaining({ params: expect.objectContaining({ settings: web }) }));
  });

  it('rendering at another rate retimes the saved doc, so the seconds stay and the frames follow', () => {
    const req = renderRequest(12, { doc: trailer(), tokens: FEEGA_TOKENS, assets: {} }, { ...settingsOf(Preset.Social), fps: 60 });

    expect([req.doc.fps, req.job.fps, req.job.totalFrames]).toEqual([60, 60, 1680]);
  });
});

describe('length by plan', () => {
  const long = () => ({ ...trailer(), durationInFrames: 90 * 30 });

  it('a video longer than the plan renders is refused before a run, with the limit', async () => {
    const { db } = fakeDb();

    expect(await startRender(db, farm, scope, request(long()), storage)).toMatchObject({ ok: false, error: RenderRefusal.Unsupported, detail: expect.stringMatching(/60 s/) });
    expect(runs.createRun).not.toHaveBeenCalled();
  });

  it('a plan with a longer limit renders it', async () => {
    const { db } = fakeDb();

    expect(await startRender(db, farm, { ...scope, plan: 'starter' }, request(long()), storage)).toMatchObject({ ok: true });
  });
});

describe('4K', () => {
  it('a 4K render composes the 1080p doc zoomed into a 3840×2160 frame', () => {
    const job = farmJob({ doc: trailer(), tokens: FEEGA_TOKENS, assets: {} }, { ...settingsOf(Preset.Social), resolution: Resolution.P2160 });

    expect([job.width, job.height]).toEqual([3840, 2160]);
    expect(job.html).toContain('zoom:2');
  });

  it('the quote follows the output resolution', async () => {
    const { db } = fakeDb();

    const result = await startRender(db, farm, scope, request(trailer(), { ...settingsOf(Preset.Social), resolution: Resolution.P2160 }), storage);

    expect(result).toMatchObject({ ok: true, quote: { resolution: Resolution.P2160, credits: 24 } });
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
