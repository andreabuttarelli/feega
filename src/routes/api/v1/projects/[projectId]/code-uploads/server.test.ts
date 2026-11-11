import { describe, it, expect, vi } from 'vitest';

const ORG = '11111111-1111-4111-8111-111111111111';
const PROJECT = '33333333-3333-4333-8333-333333333333';
const createSignedUploadUrl = vi.fn(async (path: string) => ({ data: { signedUrl: `https://storage.test/${path}?token=t` }, error: null }));

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => []) }));
vi.mock('$lib/server/projects/lookup', () => ({ findReachableProject: async () => ({ orgId: ORG, project: { id: PROJECT } }) }));

const route = await import('./+server');

type Handler = (event: unknown) => Promise<Response>;

async function call(body: unknown) {
  const db = { storage: { from: (bucket: string) => ({ bucket, createSignedUploadUrl }) } };
  const locals = { safeGetSession: async () => ({ user: { id: 'u1' } }), db: async () => db };
  const url = new URL(`https://feega.test/api/v1/projects/${PROJECT}/code-uploads`);
  const res = await (route.POST as Handler)({ params: { projectId: PROJECT }, locals, request: new Request(url, { method: 'POST', body: JSON.stringify(body) }), url });
  return { res, body: await res.json() };
}

describe('POST /api/v1/projects/:id/code-uploads', () => {
  it('firma un caricamento nella cartella dell\'org e del progetto, col nome della cartella in fondo', async () => {
    const { res, body } = await call({ name: 'my-app' });

    expect(res.status).toBe(200);
    expect(body.path).toMatch(new RegExp(`^${ORG}/${PROJECT}/code-uploads/[0-9a-f-]{36}/my-app$`));
    expect(body.uploadUrl).toContain(body.path);
    expect(createSignedUploadUrl).toHaveBeenCalledWith(body.path);
  });

  it('un nome che esce dalla cartella è rifiutato', async () => {
    const { res } = await call({ name: '../../other' });

    expect(res.status).toBe(400);
  });
});
