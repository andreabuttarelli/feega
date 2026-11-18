import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ on: true, home: '' }));

vi.mock('$lib/server/local/local-mode', () => ({ localStore: () => (state.on ? {} : null) }));
vi.mock('node:os', async (real) => ({ ...(await real<typeof import('node:os')>()), homedir: () => state.home }));

const { PUT } = await import('./+server');

const put = () => PUT({ request: new Request('http://l/x', { method: 'PUT', body: '{}' }) } as never);

describe('/api/v1/local/account/profile', () => {
  it('is 409 not_connected without a cloud session', async () => {
    state.home = await mkdtemp(join(tmpdir(), 'acct-'));

    const res = await put();

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'not_connected' });
  });

  it('is 404 outside local mode', async () => {
    state.on = false;

    await expect(put()).rejects.toMatchObject({ status: 404 });
  });
});
