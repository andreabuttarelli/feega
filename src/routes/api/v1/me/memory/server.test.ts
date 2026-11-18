import { describe, expect, it, vi } from 'vitest';
import { MEMORY_MAX_CHARS } from '$lib/onboarding/limits';

const state = { stored: null as string | null, writes: [] as { payload: Record<string, unknown>; id: unknown }[] };
const db = {
  from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { agent_memory: state.stored }, error: null }) }) }),
    update: (payload: Record<string, unknown>) => ({
      eq: async (_col: string, id: unknown) => {
        state.writes.push({ payload, id });
        return { error: null };
      }
    })
  })
};

vi.mock('$lib/server/db/client', () => ({ createUserDb: () => db }));
vi.mock('$lib/server/nav-cache', () => ({ verifiedToken: async (_db: unknown, token: string) => (token === 'good' ? { id: 'u1' } : null) }));

const { GET, PUT } = await import('./+server');

async function call(handler: unknown, method: string, body?: unknown, token = 'good') {
  const request = new Request('https://feega.test/api/v1/me/memory', {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const res = await (handler as (e: unknown) => Promise<Response>)({ request });
  return { res, body: await res.json() };
}

describe('GET /api/v1/me/memory', () => {
  it('returns the stored memory', async () => {
    state.stored = 'I make short videos';

    const { res, body } = await call(GET, 'GET');

    expect(res.status).toBe(200);
    expect(body).toEqual({ content: 'I make short videos' });
  });

  it('returns null when nothing is stored', async () => {
    state.stored = null;

    const { body } = await call(GET, 'GET');

    expect(body).toEqual({ content: null });
  });

  it('refuses a bad token', async () => {
    const { res } = await call(GET, 'GET', undefined, 'bad');

    expect(res.status).toBe(401);
  });
});

describe('PUT /api/v1/me/memory', () => {
  it('saves the memory on the caller profile', async () => {
    state.writes.length = 0;

    const { res, body } = await call(PUT, 'PUT', { content: 'Prefers calm music' });

    expect(res.status).toBe(200);
    expect(body).toEqual({ saved: true });
    expect(state.writes[0].id).toBe('u1');
    expect(state.writes[0].payload.agent_memory).toBe('Prefers calm music');
  });

  it('refuses content that is not a string', async () => {
    const { res, body } = await call(PUT, 'PUT', { content: 3 });

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: 'invalid_memory' });
  });

  it('refuses content above the limit', async () => {
    const { res, body } = await call(PUT, 'PUT', { content: 'a'.repeat(MEMORY_MAX_CHARS + 1) });

    expect(res.status).toBe(413);
    expect(body).toEqual({ error: 'memory_too_long' });
  });
});
