import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { account, cloudCall, cloudDeps, connect, forwardPut, signIn, type CloudDeps, type StoredSession } from './cloud-account';

type Call = { url: string; init?: RequestInit };

const nowS = () => Math.floor(Date.now() / 1000);

async function deps(route: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const home = await mkdtemp(join(tmpdir(), 'cloud-'));
  const fake = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return route(String(url), init);
  }) as typeof fetch;
  const d: CloudDeps = { home, fetch: fake, cloudUrl: 'https://cloud.test', supabaseUrl: 'https://sb.test', supabaseKey: 'k', timeoutMs: 5000 };
  return { d, calls };
}

async function store(home: string, session: Partial<StoredSession>) {
  await mkdir(join(home, '.config', 'feega'), { recursive: true });
  const full = { access_token: 'a1', refresh_token: 'r1', expires_at: nowS() + 3600, user: { id: 'u', email: 'me@x.io' }, ...session };
  await writeFile(join(home, '.config', 'feega', 'session.json'), JSON.stringify(full));
}

const sessionOn = async (home: string) => JSON.parse(await readFile(join(home, '.config', 'feega', 'session.json'), 'utf8'));

describe('cloud account', () => {
  it('is null without a CLI session', async () => {
    const { d } = await deps(() => new Response('{}'));

    expect(await account(d)).toBeNull();
    expect(await cloudCall('/x', {}, d)).toBeNull();
  });

  it('reads the email from the CLI session and the name from the cloud', async () => {
    const { d, calls } = await deps(() => Response.json({ name: 'Ada' }));
    await store(d.home, {});

    expect(await account(d)).toEqual({ email: 'me@x.io', name: 'Ada' });
    expect(calls[0].url).toBe('https://cloud.test/api/v1/me/profile');
    expect(new Headers(calls[0].init?.headers).get('authorization')).toBe('Bearer a1');
  });

  it('keeps the email with a null name when offline', async () => {
    const { d } = await deps(() => {
      throw new TypeError('fetch failed');
    });
    await store(d.home, {});

    expect(await account(d)).toEqual({ email: 'me@x.io', name: null });
  });

  it('refreshes an expired token and saves it where the CLI reads it', async () => {
    const { d, calls } = await deps((url) =>
      url.startsWith('https://sb.test')
        ? Response.json({ access_token: 'a2', refresh_token: 'r2', expires_at: nowS() + 3600, user: { id: 'u', email: 'me@x.io' } })
        : Response.json({ ok: true })
    );
    await store(d.home, { expires_at: nowS() - 10 });

    await cloudCall('/api/v1/me/memory', { method: 'PUT' }, d);

    expect(calls[0].url).toBe('https://sb.test/auth/v1/token?grant_type=refresh_token');
    expect(new Headers(calls[1].init?.headers).get('authorization')).toBe('Bearer a2');
    expect((await sessionOn(d.home)).refresh_token).toBe('r2');
  });

  it('forwards a PUT with the cloud status, or 409 when not connected', async () => {
    const { d } = await deps(() => Response.json({ error: 'too_long' }, { status: 400 }));
    const put = () => new Request('http://l/x', { method: 'PUT', body: JSON.stringify({ name: 'Ada' }) });

    expect((await forwardPut('/api/v1/me/profile', put(), d)).status).toBe(409);

    await store(d.home, {});
    const res = await forwardPut('/api/v1/me/profile', put(), d);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'too_long' });
  });

  it('stores the session the browser posts back to the loopback listener', async () => {
    const { d } = await deps((url) => (url === 'https://sb.test/auth/v1/user' ? Response.json({ id: 'u9', email: 'new@x.io' }) : new Response('', { status: 404 })));

    const { url } = await connect(d);
    const login = new URL(url);
    expect(login.origin + login.pathname).toBe('https://cloud.test/login');
    const port = login.searchParams.get('cli_port');
    const state = login.searchParams.get('cli_state');

    const post = (s: string | null) =>
      fetch(`http://127.0.0.1:${port}/session`, { method: 'POST', body: JSON.stringify({ access_token: 'at', refresh_token: 'rt', expires_at: 123, state: s }) });

    expect((await post('forged')).status).toBe(400);
    expect((await post(state)).status).toBe(200);
    expect(await sessionOn(d.home)).toEqual({ access_token: 'at', refresh_token: 'rt', expires_at: 123, user: { id: 'u9', email: 'new@x.io' } });
    await expect(post(state)).rejects.toThrow();
  });

  it('signs in to the hosted cloud even though local mode stubs its own Supabase', () => {
    const local = cloudDeps({ PUBLIC_SUPABASE_URL: 'http://supabase.invalid', PUBLIC_SUPABASE_ANON_KEY: 'local' });

    expect(local.supabaseUrl).toBe('https://klnswzhhgrqvbfjzioul.supabase.co');
    expect(local.supabaseKey).not.toBe('local');
    expect(cloudDeps({ FEEGA_CLOUD_SUPABASE_URL: 'https://sb.staging', FEEGA_CLOUD_SUPABASE_KEY: 'sk' })).toMatchObject({ supabaseUrl: 'https://sb.staging', supabaseKey: 'sk' });
  });

  it('signs in with email and password, saving the session where the CLI reads it and never the password', async () => {
    const { d, calls } = await deps((url) =>
      url === 'https://sb.test/auth/v1/token?grant_type=password'
        ? Response.json({ access_token: 'at', refresh_token: 'rt', expires_at: 456, user: { id: 'u7', email: 'ada@x.io' } })
        : new Response('', { status: 404 })
    );

    expect(await signIn('ada@x.io', 'hunter22', d)).toEqual({ email: 'ada@x.io' });
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ email: 'ada@x.io', password: 'hunter22' });
    expect(new Headers(calls[0].init?.headers).get('apikey')).toBe('k');

    const saved = await readFile(join(d.home, '.config', 'feega', 'session.json'), 'utf8');
    expect(JSON.parse(saved)).toEqual({ access_token: 'at', refresh_token: 'rt', expires_at: 456, user: { id: 'u7', email: 'ada@x.io' } });
    expect(saved).not.toContain('hunter22');
  });

  it('refuses wrong credentials and saves nothing', async () => {
    const { d } = await deps(() => Response.json({ error_code: 'invalid_credentials' }, { status: 400 }));

    expect(await signIn('ada@x.io', 'nope', d)).toBeNull();
    await expect(readFile(join(d.home, '.config', 'feega', 'session.json'), 'utf8')).rejects.toThrow();
  });
});
