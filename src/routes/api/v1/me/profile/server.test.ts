import { describe, expect, it, vi } from 'vitest';
import { NAME_MAX_CHARS } from '$lib/onboarding/limits';

const writes: { payload: Record<string, unknown>; id: unknown }[] = [];
const db = {
  from: () => ({
    update: (payload: Record<string, unknown>) => ({
      eq: async (_col: string, id: unknown) => {
        writes.push({ payload, id });
        return { error: null };
      }
    })
  })
};

vi.mock('$lib/server/db/client', () => ({ createUserDb: () => db }));
vi.mock('$lib/server/nav-cache', () => ({ verifiedToken: async (_db: unknown, token: string) => (token === 'good' ? { id: 'u1' } : null) }));

vi.mock('$lib/server/repos/profiles', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/profiles')>()),
  ensureProfile: async () => ({ name: 'Ada' })
}));

const { GET, PUT } = await import('./+server');

async function put(body: unknown, token = 'good') {
  const request = new Request('https://feega.test/api/v1/me/profile', {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const res = await (PUT as (e: unknown) => Promise<Response>)({ request });
  return { res, body: await res.json() };
}

describe('PUT /api/v1/me/profile', () => {
  it('saves the trimmed name on the caller profile', async () => {
    writes.length = 0;

    const { res, body } = await put({ name: '  Ada  ' });

    expect(res.status).toBe(200);
    expect(body).toEqual({ name: 'Ada' });
    expect(writes[0].id).toBe('u1');
    expect(writes[0].payload.name).toBe('Ada');
  });

  it('refuses an empty name', async () => {
    const { res, body } = await put({ name: '   ' });

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: 'invalid_name' });
  });

  it('refuses a name above the limit', async () => {
    const { res } = await put({ name: 'a'.repeat(NAME_MAX_CHARS + 1) });

    expect(res.status).toBe(400);
  });

  it('refuses a name that is not a string', async () => {
    const { res } = await put({ name: 7 });

    expect(res.status).toBe(400);
  });

  it('refuses a bad token', async () => {
    const { res } = await put({ name: 'Ada' }, 'bad');

    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/me/profile', () => {
  it('returns the caller name', async () => {
    const request = new Request('https://feega.test/api/v1/me/profile', { headers: { authorization: 'Bearer good' } });

    const res = await (GET as (e: unknown) => Promise<Response>)({ request });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ name: 'Ada' });
  });

  it('refuses a bad token', async () => {
    const request = new Request('https://feega.test/api/v1/me/profile', { headers: { authorization: 'Bearer bad' } });

    const res = await (GET as (e: unknown) => Promise<Response>)({ request });

    expect(res.status).toBe(401);
  });
});
