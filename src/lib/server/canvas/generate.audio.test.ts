import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { reconcileAudioNodeRuns, runGenNode } from './generate';
import type { AudioProvider } from './audio-provider';

const ORG = '11111111-1111-1111-1111-111111111111';
const NODE = '22222222-2222-2222-2222-222222222222';
const PROJECT = '44444444-4444-4444-4444-444444444444';
const USER = '55555555-5555-5555-5555-555555555555';
const CANVAS = '66666666-6666-6666-6666-666666666666';
const TEXT = '77777777-7777-7777-7777-777777777777';
const CLIP = '88888888-8888-8888-8888-888888888888';
const RUN = '33333333-3333-3333-3333-333333333333';

const MP3_BYTES_PER_SECOND = 16_000;
const oneSecondMp3 = () => ({ bytes: new Uint8Array(MP3_BYTES_PER_SECOND), mime: 'audio/mpeg' });

const provider = {
  speak: vi.fn(),
  changeVoice: vi.fn(),
  isolate: vi.fn(),
  compose: vi.fn(),
  soundEffect: vi.fn(),
  startDubbing: vi.fn(),
  dubbingStatus: vi.fn(),
  dubbedFile: vi.fn(),
  voices: vi.fn()
} satisfies AudioProvider;

const { configuredProvider } = vi.hoisted(() => ({ configuredProvider: vi.fn() }));
vi.mock('$lib/server/elevenlabs-config', () => ({ configuredAudioProvider: configuredProvider }));

const { logAiCall } = vi.hoisted(() => ({ logAiCall: vi.fn() }));
vi.mock('$lib/server/ai-log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/ai-log')>()),
  logAiCall
}));

vi.mock('$lib/server/supabase-admin', () => ({ createAdminClient: () => ({}) }));

const audioNode = (data: Record<string, unknown> = {}) => ({
  id: NODE,
  org_id: ORG,
  project_id: PROJECT,
  canvas_id: CANVAS,
  type: 'audio',
  display_name: null,
  x: 0,
  y: 0,
  z: 0,
  width: null,
  height: null,
  data,
  version: 1
});

const textNode = {
  ...audioNode({ refId: 'text-asset' }),
  id: TEXT,
  type: 'text'
};

const clipNode = {
  ...audioNode({ refId: 'clip-asset' }),
  id: CLIP,
  type: 'video'
};

const edge = (source: string) => ({
  id: `e-${source}`,
  canvas_id: CANVAS,
  source_node_id: source,
  target_node_id: NODE,
  source_handle: null,
  target_handle: null,
  mode: 'fixed'
});

const start = (params: Record<string, unknown>, prompt = '') => ({
  orgId: ORG,
  projectId: PROJECT,
  canvasId: CANVAS,
  nodeId: NODE,
  userId: USER,
  medium: 'audio' as const,
  prompt,
  model: null,
  params,
  expectedVersion: 1
});

beforeEach(() => {
  for (const fn of Object.values(provider)) {
    fn.mockReset();
  }
  logAiCall.mockReset();
  configuredProvider.mockReset();
  configuredProvider.mockReturnValue(provider);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'video/mp4' } })));
});

describe('an audio node speaks the text connected to it', () => {
  it('sends the connected text plus its own to ElevenLabs, stores the mp3 path where generated media is signed, bills the characters', async () => {
    provider.speak.mockResolvedValue(oneSecondMp3());
    const { db, calls } = fakeDb(
      {
        nodes: [audioNode(), textNode],
        nodes_connections: [edge(TEXT)],
        assets: [{ id: 'text-asset', org_id: ORG, project_id: PROJECT, type: 'text', content: 'Buongiorno' }]
      },
      { updateRows: { nodes: [{ ...audioNode(), version: 2 }] } }
    );

    const out = await runGenNode(db, start({ operation: 'text_to_speech', voiceId: 'v1' }, 'a tutti'));

    expect(out.kind).toBe('done');
    expect(provider.speak).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Buongiorno\n\na tutti', voiceId: 'v1', model: 'eleven_multilingual_v2' })
    );

    const upload = calls.find((c) => c.table === 'storage:brand-knowledge' && c.op === 'upload');
    const path = String(upload?.filters[0][1]);
    expect(path).toMatch(new RegExp(`^${USER}/media/audio/.+\\.mp3$`));

    const asset = calls.find((c) => c.table === 'assets' && c.op === 'insert')?.payload as Record<string, unknown>;
    expect(asset).toMatchObject({ type: 'audio', url: path, mime_type: 'audio/mpeg', duration_s: 1, source: 'generated' });
    expect(String(asset.url)).not.toContain('/sign/');

    expect(logAiCall).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'elevenlabs', model: 'eleven_multilingual_v2', ok: true, flatCostUsd: expect.closeTo(19 * 0.00008, 8), orgId: ORG })
    );
  });

  it('refuses before calling the provider when no voice is picked', async () => {
    const { db } = fakeDb({ nodes: [audioNode()], nodes_connections: [], assets: [] }, { updateRows: { nodes: [{ ...audioNode(), version: 2 }] } });

    const out = await runGenNode(db, start({ operation: 'text_to_speech' }, 'ciao'));

    expect(out).toEqual({ kind: 'refused', error: 'Pick a voice' });
    expect(provider.speak).not.toHaveBeenCalled();
  });

  it('says the key is missing instead of failing silently', async () => {
    configuredProvider.mockReturnValue(null);
    const { db } = fakeDb({ nodes: [audioNode()], nodes_connections: [], assets: [] }, { updateRows: { nodes: [{ ...audioNode(), version: 2 }] } });

    const out = await runGenNode(db, start({ operation: 'sound_effects', duration: 5 }, 'door slam'));

    expect(out).toEqual({ kind: 'refused', error: 'elevenlabs_not_configured' });
  });

  it('logs a failed call without a cost and surfaces the provider message', async () => {
    provider.soundEffect.mockRejectedValue(new Error('ElevenLabs 401: invalid api key'));
    const { db } = fakeDb({ nodes: [audioNode()], nodes_connections: [], assets: [] }, { updateRows: { nodes: [{ ...audioNode(), version: 2 }] } });

    const out = await runGenNode(db, start({ operation: 'sound_effects', duration: 5 }, 'door slam'));

    expect(out).toEqual({ kind: 'refused', error: 'ElevenLabs 401: invalid api key' });
    expect(logAiCall).toHaveBeenCalledWith(expect.objectContaining({ ok: false, provider: 'elevenlabs' }));
  });
});

describe('an audio node reads connected media', () => {
  it('isolates the voice of the connected video', async () => {
    provider.isolate.mockResolvedValue(oneSecondMp3());
    const { db } = fakeDb(
      {
        nodes: [audioNode(), clipNode],
        nodes_connections: [edge(CLIP)],
        assets: [{ id: 'clip-asset', org_id: ORG, project_id: PROJECT, type: 'video', url: `${ORG}/${PROJECT}/clip.mp4` }]
      },
      { updateRows: { nodes: [{ ...audioNode(), version: 2 }] } }
    );

    const out = await runGenNode(db, start({ operation: 'voice_isolation' }));

    expect(out.kind).toBe('done');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('clip.mp4'));
    expect(provider.isolate).toHaveBeenCalledWith({ media: { bytes: new Uint8Array([1, 2, 3]), mime: 'video/mp4' } });
  });

  it('queues dubbing as an external job the tick picks up', async () => {
    provider.startDubbing.mockResolvedValue({ jobId: 'd1' });
    const { db, calls } = fakeDb(
      {
        nodes: [audioNode(), clipNode],
        nodes_connections: [edge(CLIP)],
        assets: [{ id: 'clip-asset', org_id: ORG, project_id: PROJECT, type: 'video', url: `${ORG}/${PROJECT}/clip.mp4` }]
      },
      { updateRows: { nodes: [{ ...audioNode(), version: 2 }] } }
    );

    const out = await runGenNode(db, start({ operation: 'dubbing', targetLanguage: 'it' }));

    expect(out.kind).toBe('queued');
    expect(provider.startDubbing).toHaveBeenCalledWith(expect.objectContaining({ targetLanguage: 'it' }));
    const external = calls.find((c) => c.table === 'node_runs' && c.op === 'update' && (c.payload as Record<string, unknown>)?.external_job_id);
    expect((external?.payload as Record<string, unknown>).external_job_id).toBe('elevenlabs:dubbing:d1:it');
  });
});

describe('the run tick finishes a dubbing job', () => {
  const queued = {
    id: RUN,
    org_id: ORG,
    node_id: NODE,
    prompt: '',
    model: 'dubbing_v1',
    params: { operation: 'dubbing', targetLanguage: 'it' },
    status: 'running',
    error: null,
    output_asset_id: null,
    external_job_id: 'elevenlabs:dubbing:d1:it',
    cost_usd: null,
    attempts: 0,
    claimed_at: null,
    started_at: new Date().toISOString(),
    finished_at: null,
    actor_kind: 'user',
    actor_id: USER
  };

  it('leaves a job still dubbing for the next tick', async () => {
    provider.dubbingStatus.mockResolvedValue({ state: 'pending' });
    const { db } = fakeDb({ node_runs: [queued], nodes: [audioNode({ running: true, runId: RUN })] });

    const out = await reconcileAudioNodeRuns(db);

    expect(out).toMatchObject({ checked: 1, pending: 1, done: 0 });
    expect(provider.dubbedFile).not.toHaveBeenCalled();
  });

  it('deposits the dubbed video, bills its seconds and closes the run', async () => {
    provider.dubbingStatus.mockResolvedValue({ state: 'done', seconds: 60 });
    provider.dubbedFile.mockResolvedValue({ bytes: new Uint8Array([9]), mime: 'video/mp4' });
    const { db, calls } = fakeDb({ node_runs: [queued], nodes: [audioNode({ running: true, runId: RUN })] });

    const out = await reconcileAudioNodeRuns(db);

    expect(out).toMatchObject({ done: 1 });
    expect(provider.dubbedFile).toHaveBeenCalledWith('d1', 'it');
    const asset = calls.find((c) => c.table === 'assets' && c.op === 'insert')?.payload as Record<string, unknown>;
    expect(asset).toMatchObject({ type: 'video', mime_type: 'video/mp4', duration_s: 60 });
    expect(String(asset.url)).toMatch(/\.mp4$/);
    expect(logAiCall).toHaveBeenCalledWith(expect.objectContaining({ ok: true, flatCostUsd: expect.closeTo(0.5, 6) }));
    const done = calls.find((c) => c.table === 'node_runs' && c.op === 'update' && (c.payload as Record<string, unknown>)?.status === 'done');
    expect(done).toBeTruthy();
  });

  it('fails the run with the provider reason', async () => {
    provider.dubbingStatus.mockResolvedValue({ state: 'failed', error: 'no speech found' });
    const { db, calls } = fakeDb({ node_runs: [queued], nodes: [audioNode({ running: true, runId: RUN })] });

    const out = await reconcileAudioNodeRuns(db);

    expect(out).toMatchObject({ failed: 1 });
    const failed = calls.find((c) => c.table === 'node_runs' && c.op === 'update' && (c.payload as Record<string, unknown>)?.status === 'failed');
    expect((failed?.payload as Record<string, unknown>).error).toBe('no speech found');
  });
});
