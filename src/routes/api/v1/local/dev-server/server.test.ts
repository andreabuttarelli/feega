import { describe, expect, it, vi } from 'vitest';

const local = vi.hoisted(() => ({ on: true, calls: [] as string[] }));

vi.mock('$lib/server/local/local-mode', () => ({ localStore: () => (local.on ? { path: '/app/canvas.feega' } : null) }));

vi.mock('$lib/server/dev-server/local-dev-server', () => ({
  localDevServer: () => ({
    status: async () => ({ state: 'running', url: 'http://localhost:3000' }),
    start: async () => {
      local.calls.push('start');
      return { state: 'starting' };
    },
    stop: () => {
      local.calls.push('stop');
      return { state: 'stopped' };
    }
  })
}));

const { GET, POST } = await import('./+server');

const post = (body: unknown) => POST({ request: new Request('http://x/api/v1/local/dev-server', { method: 'POST', body: JSON.stringify(body) }) } as never);

describe('/api/v1/local/dev-server', () => {
  it('dice lo stato del dev server', async () => {
    const res = await GET({} as never);
    expect(await res.json()).toMatchObject({ state: 'running', url: 'http://localhost:3000' });
  });

  it('start e stop passano al dev server', async () => {
    expect(await (await post({ action: 'start' })).json()).toMatchObject({ state: 'starting' });
    expect(await (await post({ action: 'stop' })).json()).toMatchObject({ state: 'stopped' });
    expect(local.calls).toEqual(['start', 'stop']);
  });

  it('fuori dalla modalità locale non esiste', async () => {
    local.on = false;
    await expect(GET({} as never)).rejects.toMatchObject({ status: 404 });
    local.on = true;
  });

  it('un azione sconosciuta è un 400', async () => {
    await expect(post({ action: 'reboot' })).rejects.toMatchObject({ status: 400 });
  });
});
