import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ on: true, seen: null as string | null }));

vi.mock('$lib/server/local/local-mode', () => ({ localStore: () => (state.on ? {} : null) }));
vi.mock('$lib/server/local/onboarding-state', () => ({
  onboardingState: async () => ({ seenAt: state.seen }),
  markSeen: async () => (state.seen = 'now')
}));
vi.mock('$lib/server/local/cloud-account', () => ({ account: async () => ({ email: 'me@x.io', name: null }), cloudDeps: () => ({ cloudUrl: 'https://cloud.example' }) }));

const { GET, PUT } = await import('./+server');

describe('/api/v1/local/onboarding', () => {
  beforeEach(() => {
    state.on = true;
    state.seen = null;
  });

  it('reports seen state and account, then marks it seen', async () => {
    expect(await (await GET({} as never)).json()).toEqual({ seenAt: null, account: { email: 'me@x.io', name: null }, cloud: 'https://cloud.example' });

    expect((await PUT({} as never)).status).toBe(204);
    expect(state.seen).toBe('now');
  });

  it('is 404 outside local mode', async () => {
    state.on = false;

    await expect(GET({} as never)).rejects.toMatchObject({ status: 404 });
  });
});
