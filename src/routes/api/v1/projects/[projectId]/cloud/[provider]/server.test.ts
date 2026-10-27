import { describe, it, expect, vi, beforeEach } from 'vitest';

const findReachableProject = vi.fn();
const cloudAccess = vi.fn();
const importCanvasBytes = vi.fn();
const findAsset = vi.fn();

vi.mock('$env/dynamic/private', () => ({ env: { APP_SECRET: 'test-secret-for-cloud' } }));
vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => []) }));
vi.mock('$lib/server/projects/lookup', () => ({ findReachableProject: (...args: unknown[]) => findReachableProject(...args) }));
vi.mock('$lib/server/cloud/runtime', () => ({ cloudAccess: (...args: unknown[]) => cloudAccess(...args) }));
vi.mock('$lib/server/repos/assets', () => ({ findAsset: (...args: unknown[]) => findAsset(...args) }));
vi.mock('$lib/server/repos/asset-storage', () => ({ BUCKET_BY_SOURCE: { upload: 'canvas-assets' }, SIGNED_URL_TTL_S: { providerInput: 60 }, signStoredFile: vi.fn(async () => 'https://signed.test/file') }));
vi.mock('$lib/server/canvas/upload', () => ({
  importCanvasBytes: (...args: unknown[]) => importCanvasBytes(...args),
  UploadError: class UploadError extends Error {
    constructor(public readonly status: number, message: string) {
      super(message);
    }
  }
}));

const files = await import('./files/+server');
const imports = await import('./import/+server');
const exports = await import('./export/+server');

type Handler = (event: unknown) => Promise<Response>;

async function call(handler: unknown, provider: string, init: { method: string; body?: unknown; search?: string }) {
  const locals = { safeGetSession: async () => ({ user: { id: 'u1' } }), db: async () => ({}) };
  const url = new URL(`https://feega.test/api/v1/projects/p1/cloud/${provider}/x${init.search ?? ''}`);
  const request = new Request(url, { method: init.method, body: init.body ? JSON.stringify(init.body) : undefined });
  const res = await (handler as Handler)({ params: { projectId: 'p1', provider }, locals, request, url });
  return { res, body: await res.json() };
}

beforeEach(() => {
  vi.restoreAllMocks();
  findReachableProject.mockResolvedValue({ orgId: 'o1', project: { id: 'p1' } });
  cloudAccess.mockResolvedValue({ ok: true, token: 'at' });
  importCanvasBytes.mockResolvedValue({ asset: { id: 'asset-1' } });
});

describe('GET cloud files', () => {
  it('lists the folder through the provider with the stored token', async () => {
    const dropbox = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ entries: [{ '.tag': 'file', name: 'a.png', path_lower: '/a.png' }] })));

    const { res, body } = await call(files.GET, 'dropbox', { method: 'GET' });

    expect(res.status).toBe(200);
    expect(body.entries).toEqual([{ id: '/a.png', name: 'a.png', folder: false, mime: null }]);
    expect(dropbox).toHaveBeenCalledWith('https://api.dropboxapi.com/2/files/list_folder', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer at' }) }));
  });

  it('asks to connect when there are no tokens, without calling the provider', async () => {
    cloudAccess.mockResolvedValue({ ok: false, reason: 'not_connected' });
    const provider = vi.spyOn(globalThis, 'fetch');

    const { res, body } = await call(files.GET, 'google_drive', { method: 'GET' });

    expect(res.status).toBe(409);
    expect(body.error).toBe('not_connected');
    expect(provider).not.toHaveBeenCalled();
  });

  it('answers 404 for a provider we do not know', async () => {
    const { res } = await call(files.GET, 'box', { method: 'GET' });

    expect(res.status).toBe(404);
  });
});

describe('POST cloud import', () => {
  it('downloads the file and stores it as a project asset', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Uint8Array([1, 2]), { headers: { 'dropbox-api-result': JSON.stringify({ name: 'a.png' }), 'content-type': 'image/png' } }));

    const { res, body } = await call(imports.POST, 'dropbox', { method: 'POST', body: { fileId: '/a.png' } });

    expect(res.status).toBe(200);
    expect(body).toEqual({ asset: { id: 'asset-1' }, node: null });
    expect(importCanvasBytes).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ orgId: 'o1', projectId: 'p1', fileName: 'a.png', mime: 'image/png' }));
  });

  it('refuses a body without a file id', async () => {
    const { res } = await call(imports.POST, 'dropbox', { method: 'POST', body: {} });

    expect(res.status).toBe(400);
  });
});

describe('POST cloud export', () => {
  const UUID = '0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d';

  it('names the file as it was uploaded, not by its storage path', async () => {
    findAsset.mockResolvedValue({ url: `o1/p1/${UUID}-summer-poster.png`, projectId: 'p1', source: 'upload', mimeType: 'image/png' });
    const sent = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(new Uint8Array([1]))).mockResolvedValueOnce(new Response('{}'));

    const { res } = await call(exports.POST, 'google_drive', { method: 'POST', body: { assetId: 'a1', folder: 'root' } });

    expect(res.status).toBe(200);
    expect(await (sent.mock.calls[1]![1]!.body as Blob).text()).toContain('"name":"summer-poster.png"');
  });
});
