import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { fakeDb } from '$lib/server/db/fake-db';
import { AttachmentError, AttachmentKind, CHAT_ATTACHMENT_MAX_BYTES, chatAttachmentPrefix } from '$lib/chat-attachments';
import { ProjectMode } from '$lib/project-mode';
import { AttachmentFailure, importAttachment, loadAttachments, registerAttachment, signAttachment } from './register';

const scope = { orgId: 'org-1', projectId: 'p-1', mode: ProjectMode.Standard };
const prefix = chatAttachmentPrefix('org-1', 'p-1');
const clear = { screenImage: vi.fn(async () => ({ ok: true as const })) };
const png = async () => new Uint8Array(await sharp({ create: { width: 40, height: 20, channels: 3, background: '#0a0' } }).png().toBuffer());

const assetRow = (over: Record<string, unknown> = {}) => ({
  id: 'a-1', project_id: 'p-1', type: 'image', url: `${prefix}u__logo.png`, content: null, mime_type: 'image/png', bytes: 10,
  width: 40, height: 20, duration_s: null, source: 'upload', source_node_id: null, uncensored: false, created_at: '2026-10-09', ...over
});

const failure = async (p: Promise<unknown>) => {
  const e = await p.catch((err: unknown) => err);
  expect(e).toBeInstanceOf(AttachmentFailure);
  return e as AttachmentFailure;
};

describe('signAttachment', () => {
  it('firma un percorso nella cartella chat del progetto', async () => {
    const { db, calls } = fakeDb({});
    const signed = await signAttachment(db, scope, { name: 'logo.png', mimeType: 'image/png', bytes: 10 });
    expect(signed.path.startsWith(prefix)).toBe(true);
    expect(signed.path.endsWith('__logo.png')).toBe(true);
    expect(calls.some((c) => c.op === 'sign-upload')).toBe(true);
  });

  it('rifiuta tipo e dimensione prima di firmare', async () => {
    const { db } = fakeDb({});
    expect((await failure(signAttachment(db, scope, { name: 'a.exe', mimeType: 'application/x-msdownload', bytes: 10 }))).code).toBe(AttachmentError.Unsupported);
    expect((await failure(signAttachment(db, scope, { name: 'a.png', mimeType: 'image/png', bytes: CHAT_ATTACHMENT_MAX_BYTES + 1 }))).code).toBe(AttachmentError.TooLarge);
  });
});

describe('registerAttachment', () => {
  it('un documento diventa un asset con il markdown estratto', async () => {
    const path = `${prefix}u__notes.md`;
    const { db, calls } = fakeDb({ assets: [assetRow({ type: 'document', url: path, mime_type: 'text/markdown' })] }, { files: { [path]: readFileSync(join(__dirname, 'fixtures', 'notes.md')) } });
    const made = await registerAttachment(db, scope, { path, mimeType: 'text/markdown' }, clear);
    const insert = calls.find((c) => c.table === 'assets' && c.op === 'insert')!.payload as Record<string, unknown>;
    expect(insert).toMatchObject({ org_id: 'org-1', project_id: 'p-1', type: 'document', source: 'upload', url: path });
    expect(insert.content).toMatch(/Ship on Friday/);
    expect(made).toMatchObject({ kind: AttachmentKind.Document, name: 'notes.md' });
  });

  it('un\'immagine porta le dimensioni e passa dal controllo dei riferimenti', async () => {
    const path = `${prefix}u__logo.png`;
    const { db, calls } = fakeDb({ assets: [assetRow()] }, { files: { [path]: await png() } });
    const screen = { screenImage: vi.fn(async () => ({ ok: true as const })) };
    await registerAttachment(db, { ...scope, mode: ProjectMode.Uncensored }, { path, mimeType: 'image/png' }, screen);
    expect(screen.screenImage).toHaveBeenCalledWith({ orgId: 'org-1', mode: ProjectMode.Uncensored, url: expect.stringContaining(path) });
    expect(calls.find((c) => c.op === 'insert')!.payload).toMatchObject({ type: 'image', width: 40, height: 20 });
  });

  it('un\'immagine rifiutata non diventa asset e il file sparisce', async () => {
    const path = `${prefix}u__face.png`;
    const { db, calls } = fakeDb({}, { files: { [path]: await png() } });
    const refused = { screenImage: async () => ({ ok: false as const, error: 'Refused: people' }) };
    const e = await failure(registerAttachment(db, scope, { path, mimeType: 'image/png' }, refused));
    expect(e.code).toBe(AttachmentError.Refused);
    expect(e.message).toBe('Refused: people');
    expect(calls.some((c) => c.op === 'insert')).toBe(false);
    expect(calls.some((c) => c.op === 'remove')).toBe(true);
  });

  it('un percorso fuori dalla cartella chat del progetto è rifiutato', async () => {
    const { db } = fakeDb({});
    expect((await failure(registerAttachment(db, scope, { path: 'org-2/p-1/chat/u__x.png', mimeType: 'image/png' }, clear))).status).toBe(400);
    expect((await failure(registerAttachment(db, scope, { path: `${prefix}../u__x.png`, mimeType: 'image/png' }, clear))).status).toBe(400);
  });

  it('un file assente nello storage è un errore chiaro', async () => {
    const { db } = fakeDb({});
    expect((await failure(registerAttachment(db, scope, { path: `${prefix}u__x.png`, mimeType: 'image/png' }, clear))).code).toBe(AttachmentError.NotFound);
  });
});

describe('importAttachment', () => {
  it('scarica un URL, lo carica e lo registra', async () => {
    const body = await png();
    const fetcher = vi.fn(async () => new Response(body as BodyInit, { headers: { 'content-type': 'image/png' } }));
    const { db, calls } = fakeDb({ assets: [assetRow()] }, { files: new Proxy({}, { get: () => body }) as Record<string, Uint8Array> });
    const made = await importAttachment(db, scope, { url: 'https://example.com/brand/logo.png' }, { ...clear, fetch: fetcher as unknown as typeof fetch });
    expect(made.name).toBe('logo.png');
    expect(calls.some((c) => c.op === 'upload')).toBe(true);
  });
});

describe('loadAttachments', () => {
  it('legge solo gli asset del progetto, in ordine, con il nome dal percorso', async () => {
    const { db, calls } = fakeDb({ assets: [assetRow(), assetRow({ id: 'a-2', project_id: 'p-other' })] });
    const loaded = await loadAttachments(db, { orgId: 'org-1', projectId: 'p-1', ids: ['a-1', 'a-2'] });
    expect(loaded).toEqual([{ assetId: 'a-1', kind: AttachmentKind.Image, name: 'logo.png', mimeType: 'image/png', bytes: 10 }]);
    expect(calls[0].filters).toContainEqual(['org_id', 'org-1']);
  });
});
