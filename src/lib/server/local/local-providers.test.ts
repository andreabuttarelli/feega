import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AI_KEY_VARS, LOCAL_AI_PROVIDERS } from '$lib/local-ai-keys';

process.env.FEEGA_LOCAL_FILE = join(mkdtempSync(join(tmpdir(), 'feega-local-providers-')), 'p.feega');
process.env.HOST = '127.0.0.1';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'local';
process.env.PUBLIC_SUPABASE_URL = 'http://supabase.invalid';
process.env.PUBLIC_APP_URL = 'http://127.0.0.1:5173';

vi.mock('$env/dynamic/private', () => ({ env: process.env }));
vi.mock('$env/dynamic/public', () => ({ env: process.env }));
vi.mock('$lib/server/moderation/model-input', () => ({ screenModelInput: async () => ({ ok: true }) }));
vi.mock('$lib/server/moderation/screen', async (original) => ({ ...(await original<object>()), screenGeneration: async () => ({ ok: true }) }));

const { gateOrgAiActionForForm } = await import('$lib/server/cli-auth');
const { configuredTaskProviders } = await import('$lib/server/task-providers-config');
const { CLOUD_ONLY_ACTIONS } = await import('./local-mode');

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 7, 7, 7]);
const MP3 = new Uint8Array([73, 68, 51, 4, 0, 0, 9, 9, 9]);
const OUTPUT_URL = 'https://cdn.provider.test/out.png';

const KEYS: Record<string, Record<string, string>> = {
  kie: { KIE_API_KEY: 'k' },
  openrouter: { OPENROUTER_API_KEY: 'k' },
  llm: { LLM_API_KEY: 'k' },
  higgsfield: { HIGGSFIELD_API_KEY_ID: 'id', HIGGSFIELD_API_KEY_SECRET: 'secret' },
  wiro: { WIRO_API_KEY: 'k', WIRO_API_SECRET: 's' },
  elevenlabs: { ELEVENLABS_API_KEY: 'k' }
};

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

type Case = {
  provider: string;
  medium: 'image' | 'audio';
  model: string;
  params: Record<string, unknown>;
  row?: Record<string, unknown>;
  output: Uint8Array<ArrayBuffer>;
  answer: (url: string) => Response;
};

const CASES: Case[] = [
  {
    provider: 'kie',
    medium: 'image',
    model: 'kie/test-image',
    params: {},
    row: { wire_spec: { model: 'test-image', fields: { prompt: 'prompt', images: [] } } },
    output: PNG,
    answer: (url) =>
      url.includes('createTask')
        ? json({ code: 200, data: { taskId: 't1' } })
        : json({ code: 200, data: { state: 'success', resultJson: JSON.stringify({ resultUrls: [OUTPUT_URL] }) } })
  },
  {
    provider: 'higgsfield',
    medium: 'image',
    model: 'higgsfield/test/text-to-image',
    params: {},
    row: { wire_spec: { path: 'test/text-to-image', fields: { prompt: 'prompt', images: [] } } },
    output: PNG,
    answer: (url) =>
      url.includes('/estimate/')
        ? json({ usd: '0.01' })
        : url.endsWith('/status')
          ? json({ status: 'completed', request_id: 'r1', images: [{ url: OUTPUT_URL }] })
          : json({ status: 'queued', request_id: 'r1' })
  },
  {
    provider: 'elevenlabs',
    medium: 'audio',
    model: 'eleven_text_to_sound_v2',
    params: { operation: 'sound_effects', duration: 2 },
    output: MP3,
    answer: () => new Response(MP3, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
  }
];

afterEach(() => {
  AI_KEY_VARS.forEach((name) => delete process.env[name]);
  vi.unstubAllGlobals();
});

describe('ogni provider apre la generazione in locale con le sole sue chiavi', () => {
  it('i sei provider sono dichiarati', () => {
    expect(LOCAL_AI_PROVIDERS.map((p) => p.name).sort()).toEqual(Object.keys(KEYS).sort());
  });

  it.each(Object.keys(KEYS))('%s lascia passare il cancello', async (provider) => {
    Object.assign(process.env, KEYS[provider]);

    expect(await gateOrgAiActionForForm('org')).toBeUndefined();
  });

  it('una sola delle due chiavi Higgsfield non basta', async () => {
    process.env.HIGGSFIELD_API_KEY_ID = 'id';

    expect((await gateOrgAiActionForForm('org'))?.status).toBe(403);
  });

  it.each(['wiro', 'higgsfield', 'kie'])('%s diventa un adattatore con le sole sue chiavi', (provider) => {
    Object.assign(process.env, KEYS[provider]);

    expect(Object.keys(configuredTaskProviders(process.env))).toEqual([provider]);
  });

  it('le voci ElevenLabs non sono più riservate al cloud', () => {
    expect(Object.keys(CLOUD_ONLY_ACTIONS).filter((op) => op.startsWith('voice_'))).toEqual([]);
  });
});

describe('il risultato di ogni provider finisce negli asset del .feega', () => {
  it.each(CASES)('$provider', async ({ provider, medium, model, params, row, output, answer }) => {
    Object.assign(process.env, KEYS[provider]);
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input);
      calls.push(url);
      return url === OUTPUT_URL ? new Response(output, { status: 200, headers: { 'content-type': 'image/png' } }) : answer(url);
    });

    const { localStore } = await import('./local-mode');
    const { createNode } = await import('$lib/server/repos/canvas');
    const { runGenNode, reconcileTaskNodeRuns } = await import('$lib/server/canvas/generate');
    const { LOCAL_ORG_ID, LOCAL_USER_ID } = await import('$lib/local-user');
    const { unpackFeega } = await import('$lib/canvas/feega-file');
    const local = localStore()!;
    if (row) {
      await local.db.from('ai_models').upsert([{ id: model, catalogue: medium, provider, label: model, param_schema: {}, pricing: null, uncensored: false, ...row }], { onConflict: 'id,catalogue' });
    }
    const node = await createNode(local.db, { orgId: LOCAL_ORG_ID, projectId: local.place.projectId, canvasId: local.place.canvasId, type: medium, x: 0, y: 0, data: {}, actor: { kind: 'user', id: LOCAL_USER_ID } });

    const outcome = await runGenNode(local.db, { orgId: LOCAL_ORG_ID, projectId: local.place.projectId, canvasId: local.place.canvasId, nodeId: node.id, userId: LOCAL_USER_ID, medium, prompt: 'a red cube', model, params, expectedVersion: node.version });
    await reconcileTaskNodeRuns(local.db);
    await local.flush();
    const opened = unpackFeega(new Uint8Array(await readFile(local.path)));
    const blobs = opened.ok ? [...opened.blobs.values()] : [];

    expect(JSON.stringify(outcome)).not.toMatch(/"kind":"(refused|failed)"/);
    expect(calls.length).toBeGreaterThan(0);
    expect(blobs.some((blob) => Buffer.from(blob).equals(Buffer.from(output)))).toBe(true);
  });
});
