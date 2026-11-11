import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { runGenNode } from './generate';
import type { TaskProvider } from './task-provider';

const ORG = '11111111-1111-1111-1111-111111111111';
const NODE = '22222222-2222-2222-2222-222222222222';
const PROJECT = '44444444-4444-4444-4444-444444444444';
const USER = '55555555-5555-5555-5555-555555555555';
const CANVAS = '66666666-6666-6666-6666-666666666666';

const wiro = { run: vi.fn(), task: vi.fn() } satisfies TaskProvider;

vi.mock('$lib/server/task-providers-config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/task-providers-config')>()),
  configuredWiro: () => wiro
}));

const { logAiCall } = vi.hoisted(() => ({ logAiCall: vi.fn() }));
vi.mock('$lib/server/ai-log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/ai-log')>()),
  logAiCall
}));

const admin = vi.hoisted(() => ({ db: {} as unknown }));
vi.mock('$lib/server/supabase-admin', () => ({ createAdminClient: () => admin.db }));

const { screenModelInput } = vi.hoisted(() => ({ screenModelInput: vi.fn() }));
vi.mock('$lib/server/moderation/model-input', () => ({ screenModelInput }));

const node = (type: string) => ({
  id: NODE,
  org_id: ORG,
  project_id: PROJECT,
  canvas_id: CANVAS,
  type,
  display_name: null,
  x: 0,
  y: 0,
  z: 0,
  width: null,
  height: null,
  data: {},
  version: 1
});

const modelRow = (id: string, catalogue: string, owner: string, project: string, fixed?: Record<string, string>) => ({
  id,
  catalogue,
  provider: 'wiro',
  wire_spec: { owner, project, fields: { prompt: 'prompt', images: [] }, ...(fixed ? { fixed } : {}) }
});

const start = (medium: 'text' | 'audio', model: string, prompt: string) => ({
  orgId: ORG,
  projectId: PROJECT,
  canvasId: CANVAS,
  nodeId: NODE,
  userId: USER,
  medium,
  prompt,
  model,
  params: {},
  expectedVersion: 1
});

beforeEach(() => {
  wiro.run.mockReset();
  wiro.task.mockReset();
  logAiCall.mockReset();
  screenModelInput.mockReset();
  screenModelInput.mockResolvedValue({ ok: true });
  wiro.run.mockResolvedValue({ taskId: 't1' });
});

describe('a canvas node run on a Wiro model', () => {
  it('writes the LLM answer into the text node and bills the task cost', async () => {
    wiro.task.mockResolvedValue({ state: 'done', outputs: [], costUsd: 0.0003, text: 'Ciao a tutti.' });
    const { db, calls } = fakeDb(
      { nodes: [node('text')], ai_models: [modelRow('wiro/openai/gpt-5-nano', 'chat', 'openai', 'gpt-5-nano')] },
      { updateRows: { nodes: [{ ...node('text'), version: 2 }] } }
    );
    admin.db = db;

    const out = await runGenNode(db, start('text', 'wiro/openai/gpt-5-nano', 'Say hi'));

    expect(out.kind).toBe('done');
    expect(wiro.run).toHaveBeenCalledWith({ owner: 'openai', project: 'gpt-5-nano' }, expect.objectContaining({ prompt: expect.stringContaining('Say hi') }));
    const asset = calls.find((c) => c.table === 'assets' && c.op === 'insert')?.payload as Record<string, unknown>;
    expect(asset).toMatchObject({ type: 'text', content: 'Ciao a tutti.' });
    expect(logAiCall).toHaveBeenCalledWith(expect.objectContaining({ provider: 'wiro', ok: true, flatCostUsd: 0.0003, orgId: ORG }));
  });

  it('voices the audio node through Wiro and stores the file where generated media lives', async () => {
    wiro.task.mockResolvedValue({ state: 'done', outputs: [{ url: 'https://cdn.wiro.test/0.mp3', contentType: 'audio/mpeg' }], costUsd: 0.0004 });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(16_000), { headers: { 'content-type': 'audio/mpeg' } })));
    const { db, calls } = fakeDb(
      { nodes: [node('audio')], ai_models: [modelRow('wiro/elevenlabs/eleven-v4-turbo', 'audio', 'elevenlabs', 'eleven-v4-turbo', { voice: 'alice' })] },
      { updateRows: { nodes: [{ ...node('audio'), version: 2 }] } }
    );

    const out = await runGenNode(db, start('audio', 'wiro/elevenlabs/eleven-v4-turbo', 'Hello there'));

    expect(out.kind).toBe('done');
    expect(wiro.run).toHaveBeenCalledWith({ owner: 'elevenlabs', project: 'eleven-v4-turbo' }, { voice: 'alice', prompt: 'Hello there' });
    const upload = calls.find((c) => c.table === 'storage:brand-knowledge' && c.op === 'upload');
    expect(String(upload?.filters[0][1])).toMatch(new RegExp(`^${USER}/media/audio/.+\\.mp3$`));
    const asset = calls.find((c) => c.table === 'assets' && c.op === 'insert')?.payload as Record<string, unknown>;
    expect(asset).toMatchObject({ type: 'audio', mime_type: 'audio/mpeg', duration_s: 1, source: 'generated' });
    expect(logAiCall).toHaveBeenCalledWith(expect.objectContaining({ provider: 'wiro', model: 'wiro/elevenlabs/eleven-v4-turbo', flatCostUsd: 0.0004 }));
  });
});
