import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import type { VoiceDeps } from '$lib/server/voices/custom-voices';

const resolveOrgCaller = vi.fn();
const gateOrgAiAction = vi.fn();
const voiceDeps = vi.fn();

vi.mock('$lib/server/org-data/auth', () => ({
  resolveOrgCaller: (...args: unknown[]) => resolveOrgCaller(...args)
}));
vi.mock('$lib/server/cli-auth', () => ({
  gateOrgAiAction: (...args: unknown[]) => gateOrgAiAction(...args)
}));
vi.mock('$lib/server/voices/voices-config', () => ({
  configuredVoiceDeps: () => voiceDeps()
}));

import { POST } from './+server';

const ORG = '11111111-1111-1111-1111-111111111111';
const PROJECT = '22222222-2222-2222-2222-222222222222';
const CANVAS = '33333333-3333-3333-3333-333333333333';
const USER = '55555555-5555-5555-5555-555555555555';
const PREFIX = `${ORG}/${PROJECT}/`;

const projectRow = { id: PROJECT, org_id: ORG, name: 'p', slug: 'p', brand_id: null, archived_at: null, updated_at: '2026-10-01T00:00:00Z', mode: null };
const canvasRow = { id: CANVAS, org_id: ORG, project_id: PROJECT, name: 'One', share_token: null, shared_at: null, deleted_at: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' };

function seed() {
  const faked = fakeDb({ projects: [projectRow], canvases: [canvasRow], nodes: [], assets: [] }, { filter: true });
  resolveOrgCaller.mockResolvedValue({ caller: { db: faked.db, orgId: ORG, userId: USER, writeAllowed: true, apiKeyId: 'key-1' } });
  return faked;
}

async function call(op: string, input: Record<string, unknown>) {
  const url = new URL('https://feega.test/api/v1/org/canvas');
  const res = await (POST as (event: unknown) => Promise<Response>)({
    request: new Request(url, { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ project_id: PROJECT, op, input }) }),
    url
  });
  return { status: res.status, body: await res.json() };
}

function fakeVoices(): VoiceDeps {
  const voices = [{ id: 'v1', orgId: ORG, providerVoiceId: 'p1', name: 'Mine', method: 'design' as const, previewUrl: null, createdAt: '2026-10-01' }];
  return {
    store: {
      list: async () => voices,
      insert: async (row) => ({ id: 'v2', orgId: row.orgId, providerVoiceId: row.providerVoiceId, name: row.name, method: row.method, previewUrl: null, createdAt: '2026-10-02' }),
      remove: async () => {},
      ownedElsewhere: async () => false,
      unpurgedClones: async () => [],
      markSamplesPurged: async () => {},
      allProviderIds: async () => new Set()
    },
    provider: {
      library: async () => ({ voices: [], hasMore: false }),
      addShared: async () => 'shared-1',
      design: async () => [{ generatedVoiceId: 'g1', audioBase64: 'AA==', mime: 'audio/mpeg' }],
      saveDesign: async () => 'p2',
      clone: async () => 'p3',
      sampleIds: async () => [],
      deleteSample: async () => {},
      remove: async () => {},
      labelled: async () => [],
      slots: async () => ({ used: 0, limit: 30 })
    },
    bill: () => {},
    plan: 'pro'
  } as VoiceDeps;
}

beforeEach(() => {
  vi.clearAllMocks();
  gateOrgAiAction.mockResolvedValue(undefined);
  voiceDeps.mockReturnValue(fakeVoices());
});

describe('a file reaches a canvas node over the API, checked like the canvas upload', () => {
  it('signs an upload into the project folder for a file the canvas accepts', async () => {
    const { calls } = seed();

    const { status, body } = await call('request_upload', { fileName: 'shot.png', mimeType: 'image/png', bytes: 1000 });

    expect(status).toBe(200);
    expect(body.path.startsWith(PREFIX)).toBe(true);
    expect(body.path.endsWith('-shot.png')).toBe(true);
    expect(body.uploadUrl).toContain(body.path);
    expect(calls.some((c) => c.table === 'storage:canvas-assets' && c.op === 'sign-upload')).toBe(true);
  });

  it('refuses before signing a file over the ceiling of its kind', async () => {
    const { calls } = seed();

    const { body } = await call('request_upload', { fileName: 'big.png', mimeType: 'image/png', bytes: 50 * 1024 * 1024 });

    expect(body.error).toBe('invalid_upload');
    expect(calls.some((c) => c.op === 'sign-upload')).toBe(false);
  });

  it('refuses a format the canvas does not take', async () => {
    seed();

    const { body } = await call('request_upload', { fileName: 'a.exe', mimeType: 'application/octet-stream', bytes: 10 });

    expect(body.error).toBe('invalid_upload');
  });

  it('keeps a slash in the file name out of the storage path', async () => {
    seed();

    const { body } = await call('request_upload', { fileName: '../../x/shot.png', mimeType: 'image/png', bytes: 10 });

    expect(body.path.includes('..')).toBe(false);
    expect(body.path.slice(PREFIX.length).includes('/')).toBe(false);
  });

  it('registers the uploaded file as an asset and an image node on the canvas', async () => {
    const { calls } = seed();
    const path = `${PREFIX}abc-shot.png`;

    const { body } = await call('register_upload', { canvasId: CANVAS, path, fileName: 'shot.png', mimeType: 'image/png', bytes: 1000, x: 10, y: 20 });

    expect(body.node.type).toBe('image');
    expect(body.asset.id).toBeTruthy();
    expect(calls.some((c) => c.table === 'assets' && c.op === 'insert')).toBe(true);
  });

  it('refuses a path outside the project folder', async () => {
    seed();

    const { body } = await call('register_upload', { canvasId: CANVAS, path: 'other-org/p/x.png', fileName: 'x.png', mimeType: 'image/png', bytes: 10 });

    expect(body.error).toBe('invalid_upload');
  });

  it('refuses a canvas of another project', async () => {
    seed();

    const { body } = await call('register_upload', { canvasId: 'nope', path: `${PREFIX}a.png`, fileName: 'a.png', mimeType: 'image/png', bytes: 10 });

    expect(body.error).toBe('canvas_not_found');
  });
});

describe('custom voices over the API, through the use cases of the canvas page', () => {
  it('lists the custom voices of the org with the slots left', async () => {
    seed();

    const { body } = await call('list_voices', {});

    expect(body.custom.map((v: { id: string }) => v.id)).toEqual(['v1']);
    expect(body.slots.left).toBeGreaterThanOrEqual(0);
  });

  it('designing a voice spends, so it passes the credit gate', async () => {
    seed();
    gateOrgAiAction.mockResolvedValue(new Response(JSON.stringify({ error: 'no_credits' }), { status: 402 }));

    const { status } = await call('design_voice', { description: 'a warm low narrator voice, calm and slow' });

    expect(status).toBe(402);
  });

  it('designs previews when the gate lets it through', async () => {
    seed();

    const { body } = await call('design_voice', { description: 'a warm low narrator voice, calm and slow' });

    expect(body.previews[0].generatedVoiceId).toBe('g1');
    expect(gateOrgAiAction).toHaveBeenCalled();
  });

  it('saves a designed preview as a custom voice', async () => {
    seed();

    const { body } = await call('save_voice', { generatedVoiceId: 'g1', name: 'Narrator' });

    expect(body.voice.id).toBe('v2');
  });

  it('refuses a clone without the consent attestation', async () => {
    seed();

    const { body } = await call('clone_voice', { name: 'Me', consentBasis: 'own_voice', attested: false, seconds: 90, sampleBase64: 'AAAA', mimeType: 'audio/mpeg' });

    expect(body.error).toBe('consent_required');
  });

  it('clones a consented recording', async () => {
    seed();

    const { body } = await call('clone_voice', { name: 'Me', consentBasis: 'own_voice', attested: true, seconds: 90, sampleBase64: 'AAAA', mimeType: 'audio/mpeg' });

    expect(body.voice.id).toBe('v2');
  });

  it('adds a library voice and deletes a custom one', async () => {
    seed();

    expect((await call('use_library_voice', { ownerId: 'o', voiceId: 'lib', name: 'Lib' })).body.voiceId).toBe('shared-1');
    expect((await call('delete_voice', { id: 'v1' })).body.deleted).toBe(true);
    expect((await call('delete_voice', { id: 'nope' })).body.error).toBe('voice_not_found');
  });

  it('says so when voices are not configured', async () => {
    seed();
    voiceDeps.mockReturnValue(null);

    const { body } = await call('voice_library', {});

    expect(body.error).toBe('elevenlabs_not_configured');
  });
});
