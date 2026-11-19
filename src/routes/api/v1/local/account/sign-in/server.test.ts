import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ on: true, seen: [] as string[][] }));

vi.mock('$lib/server/local/local-mode', () => ({ localStore: () => (state.on ? {} : null) }));
vi.mock('$lib/server/local/cloud-account', () => ({
  signIn: async (email: string, password: string) => {
    state.seen.push([email, password]);
    return password === 'right' ? { email } : null;
  }
}));

const { POST } = await import('./+server');

const request = (body: unknown) => ({ request: new Request('http://127.0.0.1/api/v1/local/account/sign-in', { method: 'POST', body: JSON.stringify(body) }) }) as never;

describe('/api/v1/local/account/sign-in', () => {
  it('signs in with email and password', async () => {
    const res = await POST(request({ email: 'ada@x.io', password: 'right' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: 'ada@x.io' });
  });

  it('answers 401 on wrong credentials', async () => {
    const res = await POST(request({ email: 'ada@x.io', password: 'wrong' }));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'invalid_credentials' });
  });

  it('answers 400 without both fields, before calling the cloud', async () => {
    state.seen = [];

    expect((await POST(request({ email: 'ada@x.io' }))).status).toBe(400);
    expect(state.seen).toEqual([]);
  });

  it('is 404 outside local mode', async () => {
    state.on = false;

    await expect(POST(request({ email: 'a@b.co', password: 'right' }))).rejects.toMatchObject({ status: 404 });
  });
});
