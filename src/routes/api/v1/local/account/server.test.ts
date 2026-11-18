import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ on: true }));

vi.mock('$lib/server/local/local-mode', () => ({ localStore: () => (state.on ? {} : null) }));
vi.mock('$lib/server/local/cloud-account', () => ({ connect: async () => ({ url: 'https://cloud.test/login?cli_port=1&cli_state=s' }) }));

const { POST } = await import('./+server');

describe('/api/v1/local/account', () => {
  it('returns the login url to open', async () => {
    expect(await (await POST({} as never)).json()).toEqual({ url: 'https://cloud.test/login?cli_port=1&cli_state=s' });
  });

  it('is 404 outside local mode', async () => {
    state.on = false;

    await expect(POST({} as never)).rejects.toMatchObject({ status: 404 });
  });
});
