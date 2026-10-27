import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: { APP_SECRET: 'test-secret-for-cloud' } }));

const { CloudProvider, authorizeUrl, downloadFile, exchangeCode, freshAccess, listFiles, openState, sealState, uploadFile } = await import('./cloud');

const CREDS = { clientId: 'cid', clientSecret: 'csecret' };
const REDIRECT = 'https://feega.test/api/v1/cloud/callback';
const NOW = 1_000_000;

type Seen = { url: string; init?: RequestInit };

function fetcher(answers: (Response | (() => Response))[]) {
  const seen: Seen[] = [];
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    seen.push({ url: String(url), init });
    const next = answers.shift()!;
    return typeof next === 'function' ? next() : next;
  });
  return { fn: fn as unknown as typeof fetch, seen };
}

const jsonOf = (body: unknown) => new Response(JSON.stringify(body));

describe('authorizeUrl', () => {
  it.each([CloudProvider.Drive, CloudProvider.Dropbox])('%s asks for offline access with our state', (provider) => {
    const url = new URL(authorizeUrl(provider, { ...CREDS, redirectUri: REDIRECT, state: 'st' }));

    expect(url.searchParams.get('client_id')).toBe('cid');
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT);
    expect(url.searchParams.get('state')).toBe('st');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get(provider === CloudProvider.Drive ? 'access_type' : 'token_access_type')).toBe('offline');
  });
});

describe('the state that travels through the provider', () => {
  it('opens for the user and provider it was sealed for', () => {
    const sealed = sealState({ userId: 'u1', provider: CloudProvider.Drive, returnTo: '/p/1/c/2' }, NOW);

    expect(openState(sealed, NOW + 1000)).toEqual({ userId: 'u1', provider: CloudProvider.Drive, returnTo: '/p/1/c/2' });
  });

  it('refuses an expired or tampered state', () => {
    const sealed = sealState({ userId: 'u1', provider: CloudProvider.Drive, returnTo: '/' }, NOW);

    expect(openState(sealed, NOW + 60 * 60 * 1000)).toBeNull();
    expect(openState('garbage', NOW)).toBeNull();
  });
});

describe('exchangeCode', () => {
  it('posts the code and answers a token set with an expiry', async () => {
    const { fn, seen } = fetcher([jsonOf({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 })]);

    const tokens = await exchangeCode(CloudProvider.Dropbox, { ...CREDS, redirectUri: REDIRECT, code: 'abc' }, fn, NOW);

    expect(tokens).toEqual({ accessToken: 'at', refreshToken: 'rt', expiresAt: NOW + 3_600_000 });
    expect(seen[0].url).toBe('https://api.dropboxapi.com/oauth2/token');
    expect(String(seen[0].init?.body)).toContain('grant_type=authorization_code');
    expect(String(seen[0].init?.body)).toContain('code=abc');
  });

  it('answers null when the provider refuses', async () => {
    const { fn } = fetcher([new Response('no', { status: 400 })]);

    expect(await exchangeCode(CloudProvider.Drive, { ...CREDS, redirectUri: REDIRECT, code: 'x' }, fn, NOW)).toBeNull();
  });
});

describe('freshAccess', () => {
  it('keeps a token that has time left, without calling the provider', async () => {
    const { fn, seen } = fetcher([]);

    const out = await freshAccess(CloudProvider.Drive, { accessToken: 'at', refreshToken: 'rt', expiresAt: NOW + 600_000 }, CREDS, fn, NOW);

    expect(out?.accessToken).toBe('at');
    expect(seen).toHaveLength(0);
  });

  it('refreshes an expired one and keeps the refresh token the provider did not repeat', async () => {
    const { fn, seen } = fetcher([jsonOf({ access_token: 'new', expires_in: 3600 })]);

    const out = await freshAccess(CloudProvider.Drive, { accessToken: 'old', refreshToken: 'rt', expiresAt: NOW - 1 }, CREDS, fn, NOW);

    expect(out).toEqual({ accessToken: 'new', refreshToken: 'rt', expiresAt: NOW + 3_600_000 });
    expect(String(seen[0].init?.body)).toContain('grant_type=refresh_token');
  });
});

describe('listFiles', () => {
  it('maps a Drive folder', async () => {
    const { fn, seen } = fetcher([jsonOf({ files: [{ id: 'f1', name: 'Shots', mimeType: 'application/vnd.google-apps.folder' }, { id: 'f2', name: 'a.png', mimeType: 'image/png' }] })]);

    const entries = await listFiles(CloudProvider.Drive, 'at', null, fn);

    expect(entries).toEqual([
      { id: 'f1', name: 'Shots', folder: true, mime: null },
      { id: 'f2', name: 'a.png', folder: false, mime: 'image/png' }
    ]);
    expect(seen[0].url).toContain("'root'");
    expect((seen[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer at');
  });

  it('maps a Dropbox folder', async () => {
    const { fn, seen } = fetcher([jsonOf({ entries: [{ '.tag': 'folder', id: 'id:1', name: 'Shots', path_lower: '/shots' }, { '.tag': 'file', id: 'id:2', name: 'a.png', path_lower: '/a.png' }] })]);

    const entries = await listFiles(CloudProvider.Dropbox, 'at', null, fn);

    expect(entries.map((e) => [e.id, e.folder])).toEqual([['/shots', true], ['/a.png', false]]);
    expect(JSON.parse(String(seen[0].init?.body))).toEqual({ path: '' });
  });
});

describe('downloadFile', () => {
  it('reads a Drive file with its name and type', async () => {
    const { fn } = fetcher([jsonOf({ name: 'a.png', mimeType: 'image/png' }), new Response(new Uint8Array([1, 2, 3]))]);

    const file = await downloadFile(CloudProvider.Drive, 'at', 'f2', fn);

    expect(file).toMatchObject({ name: 'a.png', mime: 'image/png' });
    expect([...file!.bytes]).toEqual([1, 2, 3]);
  });

  it('reads a Dropbox file through the API argument header', async () => {
    const { fn, seen } = fetcher([new Response(new Uint8Array([9]), { headers: { 'dropbox-api-result': JSON.stringify({ name: 'b.jpg' }), 'content-type': 'image/jpeg' } })]);

    const file = await downloadFile(CloudProvider.Dropbox, 'at', '/b.jpg', fn);

    expect(file).toMatchObject({ name: 'b.jpg', mime: 'image/jpeg' });
    expect((seen[0].init?.headers as Record<string, string>)['Dropbox-API-Arg']).toBe(JSON.stringify({ path: '/b.jpg' }));
  });

  it('answers null when the provider says no', async () => {
    const { fn } = fetcher([new Response('x', { status: 404 })]);

    expect(await downloadFile(CloudProvider.Dropbox, 'at', '/x', fn)).toBeNull();
  });
});

describe('uploadFile', () => {
  it('puts bytes into a Dropbox folder, renaming on clash', async () => {
    const { fn, seen } = fetcher([jsonOf({ id: 'id:9' })]);

    const done = await uploadFile(CloudProvider.Dropbox, 'at', { folder: '/exports', name: 'out.png', mime: 'image/png', bytes: new Uint8Array([1]) }, fn);

    expect(done).toBe(true);
    expect(seen[0].url).toBe('https://content.dropboxapi.com/2/files/upload');
    expect(JSON.parse((seen[0].init?.headers as Record<string, string>)['Dropbox-API-Arg'])).toEqual({ path: '/exports/out.png', mode: 'add', autorename: true });
  });

  it('puts bytes into a Drive folder', async () => {
    const { fn, seen } = fetcher([jsonOf({ id: 'g1' })]);

    const done = await uploadFile(CloudProvider.Drive, 'at', { folder: 'root', name: 'out.png', mime: 'image/png', bytes: new Uint8Array([1]) }, fn);

    expect(done).toBe(true);
    expect(seen[0].url).toContain('uploadType=multipart');
  });
});
