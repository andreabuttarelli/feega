import { describe, it, expect, vi, beforeEach } from 'vitest';

const findReachableProject = vi.fn();
const cloudAccess = vi.fn();
const disconnect = vi.fn();
const connect = vi.fn();
const proxy = vi.fn();
const cloudStatuses = vi.fn();
const importCanvasBytes = vi.fn();
const findAsset = vi.fn();

vi.mock('$env/dynamic/private', () => ({ env: { APP_SECRET: 'test-secret-for-cloud' } }));
vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => []) }));
vi.mock('$lib/server/projects/lookup', () => ({ findReachableProject: (...args: unknown[]) => findReachableProject(...args) }));
vi.mock('$lib/server/cloud/runtime', async (real) => ({
  ...(await real<typeof import('$lib/server/cloud/runtime')>()),
  cloudAccess: (...args: unknown[]) => cloudAccess(...args),
  cloudAccount: () => ({ disconnect, connect }),
  cloudStatuses: (...args: unknown[]) => cloudStatuses(...args)
}));
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
const provider = await import('./+server');
const connecting = await import('./connect/+server');
const providers = await import('../+server');

const answer = (data: unknown, extra: Record<string, unknown> = {}) => ({ status: 200, data, headers: {}, file: null, ...extra });

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
  cloudAccess.mockResolvedValue({ ok: true, call: proxy });
  proxy.mockReset();
  importCanvasBytes.mockResolvedValue({ asset: { id: 'asset-1' } });
});

describe('GET cloud files', () => {
  it('lists the folder through the connected account', async () => {
    proxy.mockResolvedValue(answer({ entries: [{ '.tag': 'file', name: 'a.png', path_lower: '/a.png' }] }));

    const { res, body } = await call(files.GET, 'dropbox', { method: 'GET' });

    expect(res.status).toBe(200);
    expect(body).toEqual({ entries: [{ id: '/a.png', name: 'a.png', folder: false, mime: null, importable: true }], next: null });
    expect(proxy).toHaveBeenCalledWith(expect.objectContaining({ endpoint: 'https://api.dropboxapi.com/2/files/list_folder' }));
  });

  it('asks to connect when no account is connected, without calling the provider', async () => {
    cloudAccess.mockResolvedValue({ ok: false, reason: 'not_connected' });

    const { res, body } = await call(files.GET, 'google_drive', { method: 'GET' });

    expect(res.status).toBe(409);
    expect(body.error).toBe('not_connected');
    expect(proxy).not.toHaveBeenCalled();
  });

  it('answers 404 for a provider we do not know', async () => {
    const { res } = await call(files.GET, 'box', { method: 'GET' });

    expect(res.status).toBe(404);
  });
});

describe('POST cloud import', () => {
  it('downloads the file and stores it as a project asset', async () => {
    proxy.mockResolvedValue(answer(null, { file: 'https://files.test/a', headers: { 'dropbox-api-result': JSON.stringify({ name: 'a.png' }), 'content-type': 'image/png' } }));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Uint8Array([1, 2])));

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
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(new Uint8Array([1])));
    proxy.mockResolvedValue(answer({ id: 'f1' }));

    const { res } = await call(exports.POST, 'google_drive', { method: 'POST', body: { assetId: 'a1', folder: 'root' } });

    expect(res.status).toBe(200);
    expect(proxy).toHaveBeenLastCalledWith(expect.objectContaining({ body: { name: 'summer-poster.png' } }));
  });
});

describe('DELETE cloud provider', () => {
  it('disconnects the signed-in person from the provider', async () => {
    const { res, body } = await call(provider.DELETE, 'google_drive', { method: 'DELETE' });

    expect(res.status).toBe(200);
    expect(body).toEqual({ disconnected: true });
    expect(disconnect).toHaveBeenCalled();
  });

  it('answers 404 for a provider we do not know', async () => {
    const { res } = await call(provider.DELETE, 'box', { method: 'DELETE' });

    expect(res.status).toBe(404);
  });
});

describe('POST cloud connect', () => {
  it('answers the Composio Connect Link for OneDrive', async () => {
    connect.mockResolvedValue({ url: 'https://connect.composio.dev/x' });

    const { res, body } = await call(connecting.POST, 'one_drive', { method: 'POST', body: { returnTo: '/p/p1/c/c1' } });

    expect(res.status).toBe(200);
    expect(body).toEqual({ url: 'https://connect.composio.dev/x' });
    expect(connect).toHaveBeenCalledWith('https://feega.test', '/p/p1/c/c1');
  });

  it('answers 501 when Composio is not configured', async () => {
    connect.mockResolvedValue(null);

    expect((await call(connecting.POST, 'dropbox', { method: 'POST', body: {} })).res.status).toBe(501);
  });
});

describe('GET cloud providers', () => {
  it('says which providers are connected and which the server can connect', async () => {
    cloudStatuses.mockResolvedValue([{ provider: 'dropbox', label: 'Dropbox', connected: true, configured: true }]);

    const { res, body } = await call(providers.GET, 'dropbox', { method: 'GET' });

    expect(res.status).toBe(200);
    expect(body).toEqual({ providers: [{ provider: 'dropbox', label: 'Dropbox', connected: true, configured: true }] });
  });
});
