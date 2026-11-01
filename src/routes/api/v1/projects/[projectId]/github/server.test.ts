import { beforeEach, describe, expect, it, vi } from 'vitest';

const findReachableProject = vi.fn();
const github = { status: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), repos: vi.fn(), branches: vi.fn() };

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => []) }));
vi.mock('$lib/server/projects/lookup', () => ({ findReachableProject: (...args: unknown[]) => findReachableProject(...args) }));
vi.mock('$lib/server/code-import/github-runtime', () => ({ githubFor: () => github }));

const status = await import('./+server');
const connect = await import('./connect/+server');
const repos = await import('./repos/+server');
const branches = await import('./branches/+server');

type Handler = (event: unknown) => Promise<Response>;

async function call(handler: unknown, path: string, init: RequestInit = {}) {
  const locals = { safeGetSession: async () => ({ user: { id: 'u1' } }), db: async () => ({}) };
  const url = new URL(`https://feega.test/api/v1/projects/p1/github${path}`);
  const res = await (handler as Handler)({ params: { projectId: 'p1' }, locals, request: new Request(url, init), url });
  return { res, body: await res.json() };
}

beforeEach(() => {
  findReachableProject.mockResolvedValue({ orgId: 'o1', project: { id: 'p1' } });
  github.status.mockResolvedValue({ configured: true, connected: true, label: 'octo' });
});

describe('/api/v1/projects/:id/github', () => {
  it('dice se GitHub è configurato e collegato, mai il conto', async () => {
    const { body } = await call(status.GET, '');

    expect(body).toEqual({ configured: true, connected: true, label: 'octo' });
  });

  it('collegare risponde col Connect Link, e torna alla pagina locale chiesta', async () => {
    github.connect.mockResolvedValue({ url: 'https://connect.composio.dev/link/x' });

    const { body } = await call(connect.POST, '/connect', { method: 'POST', body: JSON.stringify({ returnTo: 'https://evil.test/' }) });

    expect(body).toEqual({ url: 'https://connect.composio.dev/link/x' });
    expect(github.connect).toHaveBeenCalledWith('https://feega.test', '/');
  });

  it('senza Composio collegare è 501 not_configured', async () => {
    github.connect.mockResolvedValue(null);

    const { res, body } = await call(connect.POST, '/connect', { method: 'POST' });

    expect(res.status).toBe(501);
    expect(body).toEqual({ error: 'not_configured' });
  });

  it('i repo e i rami arrivano solo con un account collegato', async () => {
    github.repos.mockResolvedValue([{ fullName: 'acme/app', private: true, branch: 'main' }]);
    github.branches.mockResolvedValue(['main', 'dev']);

    expect((await call(repos.GET, '/repos')).body).toEqual({ repos: [{ fullName: 'acme/app', private: true, branch: 'main' }] });
    expect((await call(branches.GET, '/branches?repo=acme/app')).body).toEqual({ branches: ['main', 'dev'] });
    expect(github.branches).toHaveBeenCalledWith({ owner: 'acme', repo: 'app', ref: null });

    github.status.mockResolvedValue({ configured: true, connected: false, label: null });
    const { res } = await call(repos.GET, '/repos');
    expect(res.status).toBe(409);
  });

  it('un repo che non è owner/nome è invalido', async () => {
    const { res } = await call(branches.GET, '/branches?repo=../../x');

    expect(res.status).toBe(400);
  });
});
