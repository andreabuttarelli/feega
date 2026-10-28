import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AI_KEY_VARS, LOCAL_AI_PROVIDERS } from '$lib/local-ai-keys';

process.env.FEEGA_LOCAL_FILE = join(mkdtempSync(join(tmpdir(), 'feega-local-ai-')), 'ai.feega');
process.env.HOST = '127.0.0.1';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'local';
process.env.PUBLIC_SUPABASE_URL = 'http://supabase.invalid';
process.env.PUBLIC_APP_URL = 'http://127.0.0.1:5173';

const { gateOrgAiActionForForm } = await import('$lib/server/cli-auth');
const { LOCAL_AI_MESSAGE } = await import('./local-mode');

vi.mock('$env/dynamic/private', () => ({ env: process.env }));
vi.mock('$lib/server/moderation/model-input', () => ({ screenModelInput: async () => ({ ok: true }) }));

const ORG = 'org';

afterEach(() => {
  AI_KEY_VARS.forEach((name) => delete process.env[name]);
});

describe('la generazione in locale segue le chiavi del provider', () => {
  it('senza chiavi rifiuta con il messaggio del cloud', async () => {
    const denial = await gateOrgAiActionForForm(ORG);

    expect(denial?.status).toBe(403);
    expect(denial?.data.message).toBe(LOCAL_AI_MESSAGE);
  });

  it.each(LOCAL_AI_PROVIDERS)('con le chiavi di $label lascia passare, senza crediti', async ({ required }) => {
    required.forEach((name) => (process.env[name] = 'sk-test-value'));

    expect(await gateOrgAiActionForForm(ORG)).toBeUndefined();
  });
});

describe('la chiave non esce mai dal processo', () => {
  const SECRET = 'sk-sentinel-4f9a1c7e';

  it('dopo una generazione il .feega non contiene la chiave, e nessun log', async () => {
    process.env.KIE_API_KEY = SECRET;
    const logged: string[] = [];
    const spies = (['log', 'info', 'warn', 'error'] as const).map((level) => vi.spyOn(console, level).mockImplementation((...args) => void logged.push(args.join(' '))));
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'hello from the model' }] }], usage: { input_tokens: 3, output_tokens: 4 } }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const { localStore } = await import('./local-mode');
    const { createNode } = await import('$lib/server/repos/canvas');
    const { runGenNode } = await import('$lib/server/canvas/generate');
    const { LOCAL_ORG_ID, LOCAL_USER_ID } = await import('$lib/local-user');
    const { unpackFeega } = await import('$lib/canvas/feega-file');
    const { readFile } = await import('node:fs/promises');
    const local = localStore()!;
    const node = await createNode(local.db, { orgId: LOCAL_ORG_ID, projectId: local.place.projectId, canvasId: local.place.canvasId, type: 'text', x: 0, y: 0, data: {}, actor: { kind: 'user', id: LOCAL_USER_ID } });

    const outcome = await runGenNode(local.db, { orgId: LOCAL_ORG_ID, projectId: local.place.projectId, canvasId: local.place.canvasId, nodeId: node.id, userId: LOCAL_USER_ID, medium: 'text', prompt: 'say hello', model: 'kie/gpt-6-luna', params: {}, expectedVersion: node.version });
    await local.flush();
    const saved = new Uint8Array(await readFile(local.path));
    const opened = unpackFeega(saved);

    spies.forEach((spy) => spy.mockRestore());
    vi.unstubAllGlobals();
    expect(JSON.stringify(outcome)).toContain('"kind":"done"');
    expect(JSON.stringify(opened.ok ? opened.file : null)).toContain('hello from the model');
    expect(Buffer.from(saved).includes(SECRET)).toBe(false);
    expect(JSON.stringify(opened.ok ? opened.file : null)).not.toContain(SECRET);
    expect(logged.join('\n')).not.toContain(SECRET);
  });
});
