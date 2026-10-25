import { beforeEach, describe, expect, it, vi } from 'vitest';

const LOCAL = { projectId: 'proj-local', canvasId: 'canvas-local' };
const DEMO_TOKEN = 'demo-access-token';

vi.mock('$env/dynamic/public', () => ({
  env: { PUBLIC_SUPABASE_URL: 'http://localhost:8000', PUBLIC_SUPABASE_ANON_KEY: 'anon-key', PUBLIC_APP_URL: 'http://localhost:5173' }
}));

vi.mock('$env/dynamic/private', () => ({ env: { FEEGA_LOCAL_MODE: '1' } }));

vi.mock('@sentry/sveltekit', () => ({
  sentryHandle: () => ({ event, resolve }: { event: unknown; resolve: (event: unknown) => unknown }) => resolve(event),
  handleErrorWithSentry: () => () => undefined
}));

vi.mock('@sveltejs/kit/hooks', () => ({
  sequence:
    (...handlers: Array<(input: { event: any; resolve: any }) => any>) =>
    ({ event, resolve }: { event: any; resolve: any }) => {
      const run = (index: number, next: any): any =>
        index === handlers.length ? resolve(next) : handlers[index]({ event: next, resolve: (e: any) => run(index + 1, e) });
      return run(0, event);
    }
}));

const signedIn: string[] = [];

vi.mock('@supabase/ssr', async (orig) => ({
  ...(await orig<object>()),
  createServerClient: (_url: string, _key: string, options: { cookies: { setAll: (c: unknown[]) => void } }) => ({
    auth: {
      getSession: async () => ({ data: { session: null } }),
      signInWithPassword: async ({ email }: { email: string }) => {
        signedIn.push(email);
        options.cookies.setAll([{ name: 'sb-localhost-auth-token', value: 'demo-cookie', options: {} }]);
        return { data: { session: { access_token: DEMO_TOKEN } }, error: null };
      }
    }
  })
}));

vi.mock('$lib/server/db/client', async (orig) => ({
  ...(await orig<object>()),
  createUserDb: () => ({
    from: (table: string) => {
      const row = table === 'projects' ? { id: LOCAL.projectId } : { id: LOCAL.canvasId };
      const chain: any = { select: () => chain, eq: () => chain, is: () => chain, order: () => chain, limit: () => chain, maybeSingle: async () => ({ data: row, error: null }) };
      return chain;
    }
  })
}));

vi.mock('$lib/server/nav-cache', () => ({
  verifiedToken: async () => ({ id: 'demo-user' }),
  verifiedUser: async () => null
}));

vi.stubGlobal(
  'fetch',
  vi.fn(async () => new Response(JSON.stringify({ access_token: DEMO_TOKEN, expires_in: 3600 }), { status: 200 }))
);

const { handle } = await import('./hooks.server');

type Seen = { authorization: string | null };

function eventFor(path: string, init: { params?: Record<string, string>; headers?: Record<string, string>; body?: unknown; method?: string } = {}) {
  const jar = new Map<string, string>();
  const url = new URL(`http://localhost:5173${path}`);
  return {
    jar,
    event: {
      request: new Request(url, {
        method: init.method ?? (init.body ? 'POST' : 'GET'),
        headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers },
        body: init.body ? JSON.stringify(init.body) : undefined
      }),
      url,
      route: { id: path },
      params: init.params ?? {},
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        get: (name: string) => jar.get(name),
        set: (name: string, value: string) => jar.set(name, value)
      },
      locals: {}
    }
  };
}

async function serve(path: string, init: Parameters<typeof eventFor>[1] = {}) {
  const { event, jar } = eventFor(path, init);
  const seen: Seen = { authorization: null };
  try {
    const response = await handle({
      event,
      resolve: async (e: any) => {
        seen.authorization = e.request.headers.get('authorization');
        return new Response('ok');
      }
    } as any);
    return { status: response.status, location: null as string | null, seen, jar, body: await response.text() };
  } catch (thrown: any) {
    return { status: thrown.status as number, location: (thrown.location as string) ?? null, seen, jar, body: '' };
  }
}

const OWN_CANVAS = `/p/${LOCAL.projectId}/c/${LOCAL.canvasId}`;

describe('local mode: un agente usa feega senza login', () => {
  beforeEach(() => {
    signedIn.length = 0;
  });

  it('una richiesta API senza Bearer gira come l’utente demo', async () => {
    const answer = await serve('/api/v1/edit', { body: { op: 'describe' } });

    expect(answer.status).toBe(200);
    expect(answer.seen.authorization).toBe(`Bearer ${DEMO_TOKEN}`);
  });

  it('il token segnaposto della CLI vale come nessun token', async () => {
    const answer = await serve('/api/v1/edit', { body: { op: 'describe' }, headers: { authorization: 'Bearer local-mode' } });

    expect(answer.seen.authorization).toBe(`Bearer ${DEMO_TOKEN}`);
  });

  it('un progetto diverso da quello locale è rifiutato con 403', async () => {
    const answer = await serve('/api/v1/edit', { body: { op: 'add_node', project_id: 'someone-else' } });

    expect(answer.status).toBe(403);
    expect(answer.seen.authorization).toBeNull();
  });

  it('una tela diversa dentro l’input dell’op è rifiutata con 403', async () => {
    const answer = await serve('/api/v1/org/canvas', { body: { project_id: LOCAL.projectId, op: 'create_node', input: { canvasId: 'other' } } });

    expect(answer.status).toBe(403);
  });

  it('una tela diversa nella rotta è rifiutata con 403', async () => {
    const answer = await serve(`/api/v1/projects/${LOCAL.projectId}/canvases/other`, { params: { projectId: LOCAL.projectId, canvasId: 'other' } });

    expect(answer.status).toBe(403);
  });

  it('il progetto locale passa', async () => {
    const answer = await serve('/api/v1/edit', { body: { op: 'add_node', project_id: LOCAL.projectId } });

    expect(answer.status).toBe(200);
  });

  it('la radice porta alla tela locale', async () => {
    expect(await serve('/')).toMatchObject({ status: 303, location: OWN_CANVAS });
  });

  it.each(['/app', '/app/credits', '/login', '/account/settings', '/admin'])('%s porta alla tela locale', async (path) => {
    expect(await serve(path)).toMatchObject({ status: 303, location: OWN_CANVAS });
  });

  it('un altro progetto porta alla tela locale', async () => {
    expect(await serve('/p/other/c/x', { params: { projectId: 'other', canvasId: 'x' } })).toMatchObject({ status: 303, location: OWN_CANVAS });
  });

  it('la tela locale senza sessione entra come utente demo', async () => {
    const answer = await serve(OWN_CANVAS, { params: LOCAL });

    expect(answer.status).toBe(200);
    expect(signedIn).toEqual(['demo@feega.local']);
    expect(answer.jar.get('sb-localhost-auth-token')).toBe('demo-cookie');
  });

  it('con una sessione già aperta non rientra', async () => {
    const { event, jar } = eventFor(OWN_CANVAS, { params: LOCAL });
    jar.set('sb-localhost-auth-token', 'existing');

    await handle({ event, resolve: async () => new Response('ok') } as any);

    expect(signedIn).toEqual([]);
  });
});

describe('local mode non parte esposta in rete', () => {
  it('l’avvio con PUBLIC_APP_URL non locale fallisce con un errore chiaro', async () => {
    const { env } = await import('$env/dynamic/public');
    const { init } = await import('./hooks.server');
    env.PUBLIC_APP_URL = 'https://oh.feega.app';
    try {
      expect(() => init()).toThrow(/PUBLIC_APP_URL/);
    } finally {
      env.PUBLIC_APP_URL = 'http://localhost:5173';
    }
  });
});
