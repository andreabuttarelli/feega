import { describe, expect, it, vi } from 'vitest';
import type { PluginStore, CatalogueRow } from '$lib/server/plugins/store';

const calls: string[] = [];
const rows: CatalogueRow[] = [
  { id: 'mesh-gradient', name: 'Mesh gradient', summary: 's', author: 'Feega', tier: 'free', latestVersion: '1.0.0', manifest: {}, installs: 4, activeInstalls: 2, upvotes: 1 }
];

const store: PluginStore = {
  catalogue: async (id) => rows.filter((r) => !id || r.id === id),
  mine: async () => ({ installed: { 'mesh-gradient': { enabled: true } }, voted: [] }),
  orgOf: async () => 'org-1',
  install: async (i) => void calls.push(`install:${i.pluginId}`),
  uninstall: async (_u, id) => void calls.push(`uninstall:${id}`),
  setEnabled: async (_u, id, enabled) => {
    calls.push(`enabled:${id}:${enabled}`);
    return true;
  },
  vote: async (_u, id) => void calls.push(`vote:${id}`),
  unvote: async (_u, id) => void calls.push(`unvote:${id}`),
  heartbeat: async (_u, ids) => void calls.push(`heartbeat:${ids.join(',')}`)
};

vi.mock('$lib/server/plugins/store', () => ({ supabasePluginStore: () => store }));
vi.mock('$lib/server/db/client', () => ({ createAnonDb: () => ({}) }));
vi.mock('$lib/server/cli-auth', async () => {
  const { json } = await import('@sveltejs/kit');
  return {
    authenticate: async (request: Request) =>
      request.headers.get('authorization') === 'Bearer good'
        ? { supabase: {}, user: { id: 'u1' } }
        : { error: json({ error: 'Invalid or expired token' }, { status: 401 }) }
  };
});

const list = await import('./+server');
const one = await import('./[id]/+server');
const install = await import('./[id]/install/+server');
const vote = await import('./[id]/vote/+server');
const heartbeat = await import('./heartbeat/+server');

type Handler = (event: unknown) => Promise<Response>;

function call(handler: unknown, method: string, params: Record<string, string>, body?: unknown, token = 'good') {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  const request = new Request('https://feega.test/api/v1/plugins', { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });

  return (handler as Handler)({ request, params });
}

describe('GET /api/v1/plugins', () => {
  it('lists the catalogue to an anonymous visitor without personal flags', async () => {
    const res = await call(list.GET, 'GET', {}, undefined, '');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.plugins[0]).toMatchObject({ id: 'mesh-gradient', installs: 4, installedByMe: false });
  });

  it('adds my flags for a signed-in caller', async () => {
    const res = await call(list.GET, 'GET', {});
    const body = await res.json();

    expect(body.plugins[0]).toMatchObject({ installedByMe: true, enabledByMe: true });
  });

  it('refuses a bad token', async () => {
    const res = await call(list.GET, 'GET', {}, undefined, 'bad');

    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/plugins/:id', () => {
  it('answers 404 for an unknown plugin', async () => {
    const res = await call(one.GET, 'GET', { id: 'nope' }, undefined, '');

    expect(res.status).toBe(404);
  });
});

describe('install, vote and heartbeat', () => {
  it('POST install reaches the store', async () => {
    calls.length = 0;

    const res = await call(install.POST, 'POST', { id: 'mesh-gradient' });

    expect(res.status).toBe(200);
    expect(calls).toEqual(['install:mesh-gradient']);
  });

  it('install needs a sign-in', async () => {
    const res = await call(install.POST, 'POST', { id: 'mesh-gradient' }, undefined, '');

    expect(res.status).toBe(401);
  });

  it('PATCH install needs a boolean', async () => {
    const res = await call(install.PATCH, 'PATCH', { id: 'mesh-gradient' }, { enabled: 'yes' });

    expect(res.status).toBe(400);
  });

  it('PATCH install toggles enabled', async () => {
    calls.length = 0;

    const res = await call(install.PATCH, 'PATCH', { id: 'mesh-gradient' }, { enabled: false });

    expect(res.status).toBe(200);
    expect(calls).toEqual(['enabled:mesh-gradient:false']);
  });

  it('DELETE install uninstalls', async () => {
    calls.length = 0;

    await call(install.DELETE, 'DELETE', { id: 'mesh-gradient' });

    expect(calls).toEqual(['uninstall:mesh-gradient']);
  });

  it('POST and DELETE vote reach the store', async () => {
    calls.length = 0;

    await call(vote.POST, 'POST', { id: 'mesh-gradient' });
    await call(vote.DELETE, 'DELETE', { id: 'mesh-gradient' });

    expect(calls).toEqual(['vote:mesh-gradient', 'unvote:mesh-gradient']);
  });

  it('heartbeat records the ids of a signed-in caller', async () => {
    calls.length = 0;

    const res = await call(heartbeat.POST, 'POST', {}, { pluginIds: ['mesh-gradient'] });

    expect(res.status).toBe(200);
    expect(calls).toEqual(['heartbeat:mesh-gradient']);
  });

  it('heartbeat refuses an anonymous caller and records nothing', async () => {
    calls.length = 0;

    const res = await call(heartbeat.POST, 'POST', {}, { pluginIds: ['mesh-gradient'] }, '');

    expect(res.status).toBe(401);
    expect(calls).toEqual([]);
  });

  it('heartbeat refuses a malformed body', async () => {
    const res = await call(heartbeat.POST, 'POST', {}, { pluginIds: 'mesh-gradient' });

    expect(res.status).toBe(400);
  });
});
