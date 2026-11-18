import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeGithub, type FakeGithub } from '$lib/server/code-push/fake-github.testkit';
import { githubHost } from '$lib/server/code-push/github-host';
import { memoryLock } from '$lib/server/code-push/push-lock';
import { EntryKind, linkSchema, type CodeLink } from '$lib/server/code-push/link';

const findReachableProject = vi.fn();
const codeEdits = vi.fn();
let gh: FakeGithub;
let connected = true;
let links: Map<string, CodeLink>;
const lock = memoryLock();

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => []) }));
vi.mock('$lib/server/projects/lookup', () => ({ findReachableProject: (...args: unknown[]) => findReachableProject(...args) }));
vi.mock('$lib/server/code-push/frames-runtime', () => ({
  framesDeps: () => ({
    host: async () => (connected ? githubHost(gh.call, { owner: 'acme', repo: 'app', ref: null }) : null),
    edits: (...args: unknown[]) => codeEdits(...args),
    links: { read: async (id: string) => links.get(id) ?? null, all: async (id: string) => (links.has(id) ? [links.get(id)!] : []), inProject: async () => [...links.values()], save: async (id: string, l: CodeLink) => Boolean(links.set(id, l)), remove: async (id: string) => links.delete(id) },
    lock
  })
}));

const push = await import('./+server');
const undo = await import('./undo/+server');

type Handler = (event: unknown) => Promise<Response>;

async function call(handler: unknown, path: string, init: RequestInit = {}) {
  const locals = { safeGetSession: async () => ({ user: { id: 'u1' } }), db: async () => ({}) };
  const url = new URL(`https://feega.test/api/v1/projects/p1/github/push${path}`);
  const res = await (handler as Handler)({ params: { projectId: 'p1' }, locals, request: new Request(url, init), url });
  return { res, body: await res.json() };
}

const post = (handler: unknown, body: unknown) => call(handler, '', { method: 'POST', body: JSON.stringify(body) });

beforeEach(async () => {
  gh = fakeGithub();
  connected = true;
  findReachableProject.mockResolvedValue({ orgId: 'o1', project: { id: 'p1' } });
  codeEdits.mockResolvedValue({ repo: 'acme/app', kind: 'github', files: [{ path: 'src/Hero.tsx', content: 'v1' }], skipped: [] });
  const baseSha = gh.seed('main', { 'README.md': 'hi', 'src/Hero.tsx': 'v0' });
  links = new Map([['n1', linkSchema.parse({ repo: 'acme/app', entryKind: EntryKind.Page, entry: 'src/Hero.tsx', route: '/', baseBranch: 'main', baseSha })]]);
});

describe('/api/v1/projects/:id/github/push', () => {
  it('le modifiche dei frame diventano un commit sul ramo feega/ e una PR, e il link lo ricorda', async () => {
    const { res, body } = await post(push.POST, { name: 'hero', nodeIds: ['n1'] });

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, branch: 'feega/hero', pull: { number: 1 } });
    expect(gh.files('feega/hero')['src/Hero.tsx']).toBe('v1');
    expect(links.get('n1')).toMatchObject({ pushBranch: 'feega/hero', pushSha: body.sha, pullNumber: 1, pushTouched: ['src/Hero.tsx'] });
    expect(codeEdits).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'o1', projectId: 'p1', userId: 'u1' }), 'n1', 'instance');
  });

  it('lo stato è calcolato: modificato con la PR aperta, poi più recente a monte', async () => {
    await post(push.POST, { name: 'hero', nodeIds: ['n1'] });

    expect((await call(push.GET, '?nodeId=n1')).body).toMatchObject({ ok: true, state: 'modified', push: { pull: { status: 'open' } } });

    codeEdits.mockResolvedValue({ repo: 'acme/app', kind: 'github', files: [], skipped: [] });
    gh.seed('main', { ...gh.files('main'), 'src/Hero.tsx': 'upstream' });
    expect((await call(push.GET, '?nodeId=n1')).body).toMatchObject({ state: 'newer_upstream' });
  });

  it('un rinomino a monte aggiorna il link da solo', async () => {
    gh.seed('main', { 'README.md': 'hi', 'ui/Hero.tsx': 'v0' });

    await call(push.GET, '?nodeId=n1');

    expect(links.get('n1')?.entry).toBe('ui/Hero.tsx');
  });

  it('senza GitHub collegato è 409 not_connected', async () => {
    connected = false;

    const { res, body } = await post(push.POST, { name: 'hero', nodeIds: ['n1'] });

    expect(res.status).toBe(409);
    expect(body).toEqual({ ok: false, refusal: 'not_connected' });
  });

  it('chi legge soltanto riceve la patch con 403', async () => {
    gh = fakeGithub({ push: false });

    const { res, body } = await post(push.POST, { name: 'hero', nodeIds: ['n1'] });

    expect(res.status).toBe(403);
    expect(body).toMatchObject({ refusal: 'read_only', patch: [{ path: 'src/Hero.tsx', content: 'v1' }] });
  });

  it('frame di repo diversi non vanno nella stessa spinta', async () => {
    codeEdits.mockResolvedValueOnce({ repo: 'acme/app', kind: 'github', files: [], skipped: [] }).mockResolvedValueOnce({ repo: 'acme/other', kind: 'github', files: [], skipped: [] });

    expect((await post(push.POST, { name: 'hero', nodeIds: ['n1', 'n2'] })).res.status).toBe(400);
  });

  it('una richiesta senza nome o frame è 400', async () => {
    expect((await post(push.POST, { nodeIds: [] })).res.status).toBe(400);
  });

  it('staccare toglie il link, una seconda volta è 404', async () => {
    expect((await call(push.DELETE, '?nodeId=n1', { method: 'DELETE' })).res.status).toBe(200);
    expect(links.has('n1')).toBe(false);
    expect((await call(push.DELETE, '?nodeId=n1', { method: 'DELETE' })).res.status).toBe(404);
  });

  it('annullare è un commit in avanti che rimette i file toccati', async () => {
    await post(push.POST, { name: 'hero', nodeIds: ['n1'] });

    const { res } = await post(undo.POST, { nodeId: 'n1' });

    expect(res.status).toBe(200);
    expect(gh.files('feega/hero')['src/Hero.tsx']).toBe('v0');
  });
});
