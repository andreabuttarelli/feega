import { describe, expect, it, vi } from 'vitest';

const { USER } = vi.hoisted(() => ({ USER: { id: 'u1', email: 'ada@x.it' } }));

vi.mock('$lib/server/db/client', async (original) => ({ ...(await original<object>()), createUserDb: () => ({}) }));
vi.mock('$lib/server/nav-cache', async (original) => ({ ...(await original<object>()), verifiedToken: async (_db: unknown, token: string) => (token === 'jwt' ? USER : null) }));
const projectShell = vi.fn();
vi.mock('$lib/server/projects/project-shell', () => ({ load: projectShell }));

const { GET } = await import('./+server');

function get(token = 'jwt') {
  const url = new URL('https://feega.test/api/v1/projects/p1/home');
  const request = new Request(url, { headers: { authorization: `Bearer ${token}` } });
  return GET({ request, url, params: { projectId: 'p1' } } as never);
}

describe('the project home over bearer', () => {
  it('answers where the project opens: its first canvas', async () => {
    projectShell.mockResolvedValue({ project: { id: 'p1' }, org: { id: 'org1' }, canvases: [{ id: 'c1' }] });
    const res = await get();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ redirect: '/p/p1/c/c1' });
  });

  it('refuses without a valid bearer', async () => {
    expect((await get('bad')).status).toBe(401);
  });
});
