import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fakeDb, type FakeDb } from '$lib/server/db/fake-db';
import { CHAT_ATTACHMENT_MAX_BYTES, chatAttachmentPrefix } from '$lib/chat-attachments';

const reach = vi.hoisted(() => ({ found: true as boolean }));
vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: async () => [] }));
vi.mock('$lib/server/projects/lookup', () => ({
  findReachableProject: async () => (reach.found ? { orgId: 'org-1', project: { id: 'p-1', name: 'P', brandId: null, mode: 'standard' } } : null)
}));
const screen = vi.hoisted(() => ({ outcome: { ok: true } as { ok: boolean; error?: string } }));
vi.mock('$lib/server/moderation/model-input', () => ({ screenModelReferences: async () => screen.outcome }));

const { POST: commit } = await import('./+server');
const { POST: sign } = await import('./sign/+server');

let world: FakeDb;
const prefix = chatAttachmentPrefix('org-1', 'p-1');

function event(body: unknown, user: { id: string } | null = { id: 'u-1' }) {
  const request = new Request('http://x/api/v1/projects/p-1/attachments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const locals = { safeGetSession: async () => ({ session: user ? { access_token: 't' } : null, user }), db: async () => world.db };
  return { request, url: new URL(request.url), params: { projectId: 'p-1' }, locals } as never;
}

const assetRow = { id: 'a-1', project_id: 'p-1', type: 'document', url: `${prefix}u__notes.md`, content: '# Notes', mime_type: 'text/markdown', bytes: 7, width: null, height: null, duration_s: null, source: 'upload', source_node_id: null, uncensored: false, created_at: '2026-10-09' };

describe('POST /api/v1/projects/[projectId]/attachments/sign', () => {
  beforeEach(() => {
    reach.found = true;
    world = fakeDb({});
  });

  it('senza sessione: 401', async () => {
    expect((await sign(event({ name: 'a.png', mimeType: 'image/png', bytes: 1 }, null))).status).toBe(401);
  });

  it('un progetto fuori dalle org dell\'utente: 404', async () => {
    reach.found = false;
    expect((await sign(event({ name: 'a.png', mimeType: 'image/png', bytes: 1 }))).status).toBe(404);
  });

  it('tipo e dimensione: errori chiari', async () => {
    const wrong = await sign(event({ name: 'a.mp4', mimeType: 'video/mp4', bytes: 1 }));
    expect(wrong.status).toBe(400);
    expect(await wrong.json()).toMatchObject({ code: 'attachment_unsupported' });
    expect((await sign(event({ name: 'a.png', mimeType: 'image/png', bytes: CHAT_ATTACHMENT_MAX_BYTES + 1 }))).status).toBe(413);
  });

  it('firma un percorso della cartella chat del progetto', async () => {
    const res = await sign(event({ name: 'logo.png', mimeType: 'image/png', bytes: 1 }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.path.startsWith(prefix)).toBe(true);
    expect(body.uploadUrl).toMatch(/^https:/);
  });
});

describe('POST /api/v1/projects/[projectId]/attachments', () => {
  beforeEach(() => {
    reach.found = true;
    screen.outcome = { ok: true };
  });

  it('registra un file caricato e torna l\'allegato', async () => {
    world = fakeDb({ assets: [assetRow] }, { files: { [`${prefix}u__notes.md`]: new TextEncoder().encode('# Notes') } });
    const res = await commit(event({ path: `${prefix}u__notes.md`, mimeType: 'text/markdown' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ attachment: { assetId: 'a-1', kind: 'document', name: 'notes.md', mimeType: 'text/markdown', bytes: 7 } });
  });

  it('un percorso di un\'altra org: 400', async () => {
    world = fakeDb({});
    expect((await commit(event({ path: 'org-2/p-1/chat/u__x.md', mimeType: 'text/markdown' }))).status).toBe(400);
  });

  it('un\'immagine rifiutata dalla moderazione: 422 con il motivo', async () => {
    const png = new Uint8Array(await (await import('sharp')).default({ create: { width: 2, height: 2, channels: 3, background: '#000' } }).png().toBuffer());
    world = fakeDb({}, { files: { [`${prefix}u__p.png`]: png } });
    screen.outcome = { ok: false, error: 'Refused: people' };
    const res = await commit(event({ path: `${prefix}u__p.png`, mimeType: 'image/png' }));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'Refused: people', code: 'attachment_refused' });
  });
});

