import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: { APP_SECRET: 'test-secret-for-cloud' } }));

const { CloudProvider, revokeAccess, authorizeUrl, downloadFile, exchangeCode, freshAccess, listFiles, openState, sealState, uploadFile } = await import('./cloud');

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

    const page = await listFiles(CloudProvider.Drive, 'at', null, null, fn);

    expect(page).toEqual({
      entries: [
        { id: 'f1', name: 'Shots', folder: true, mime: null, importable: true },
        { id: 'f2', name: 'a.png', folder: false, mime: 'image/png', importable: true }
      ],
      next: null
    });
    expect(new URL(seen[0].url).searchParams.get('q')).toContain("'root'");
    expect((seen[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer at');
  });

  it('maps a Dropbox folder', async () => {
    const { fn, seen } = fetcher([jsonOf({ entries: [{ '.tag': 'folder', id: 'id:1', name: 'Shots', path_lower: '/shots' }, { '.tag': 'file', id: 'id:2', name: 'a.png', path_lower: '/a.png' }] })]);

    const { entries } = await listFiles(CloudProvider.Dropbox, 'at', null, null, fn);

    expect(entries.map((e) => [e.id, e.folder])).toEqual([['/shots', true], ['/a.png', false]]);
    expect(JSON.parse(String(seen[0].init?.body))).toEqual({ path: '', limit: 200 });
  });
});

describe('listFiles pages', () => {
  it('hands back the Drive page token and sends it for the next page', async () => {
    const { fn, seen } = fetcher([jsonOf({ files: [], nextPageToken: 'pt2' }), jsonOf({ files: [{ id: 'f9', name: 'z.png', mimeType: 'image/png' }] })]);

    const first = await listFiles(CloudProvider.Drive, 'at', null, null, fn);
    const second = await listFiles(CloudProvider.Drive, 'at', null, first.next, fn);

    expect(first.next).toBe('pt2');
    expect(new URL(seen[1].url).searchParams.get('pageToken')).toBe('pt2');
    expect(second).toMatchObject({ entries: [{ id: 'f9' }], next: null });
  });

  it('continues a Dropbox listing from its cursor', async () => {
    const { fn, seen } = fetcher([jsonOf({ entries: [], has_more: true, cursor: 'c1' }), jsonOf({ entries: [{ '.tag': 'file', name: 'b.png', path_lower: '/b.png' }], has_more: false, cursor: 'c2' })]);

    const first = await listFiles(CloudProvider.Dropbox, 'at', null, null, fn);
    const second = await listFiles(CloudProvider.Dropbox, 'at', null, first.next, fn);

    expect(first.next).toBe('c1');
    expect(seen[1].url).toBe('https://api.dropboxapi.com/2/files/list_folder/continue');
    expect(JSON.parse(String(seen[1].init?.body))).toEqual({ cursor: 'c1' });
    expect(second).toMatchObject({ entries: [{ id: '/b.png' }], next: null });
  });
});

describe('native Google files', () => {
  const doc = { id: 'd1', name: 'Plan', mimeType: 'application/vnd.google-apps.document' };
  const form = { id: 'd2', name: 'Survey', mimeType: 'application/vnd.google-apps.form' };

  it('lists a Doc as importable and a Form as not', async () => {
    const { fn } = fetcher([jsonOf({ files: [doc, form] })]);

    const { entries } = await listFiles(CloudProvider.Drive, 'at', null, null, fn);

    expect(entries.map((e) => [e.name, e.importable])).toEqual([['Plan', true], ['Survey', false]]);
  });

  it('exports a Doc to PDF instead of downloading it', async () => {
    const { fn, seen } = fetcher([jsonOf({ name: 'Plan', mimeType: doc.mimeType }), new Response(new Uint8Array([7]))]);

    const file = await downloadFile(CloudProvider.Drive, 'at', 'd1', fn);

    expect(new URL(seen[1].url).pathname).toMatch(/\/d1\/export$/);
    expect(new URL(seen[1].url).searchParams.get('mimeType')).toBe('application/pdf');
    expect(file).toMatchObject({ name: 'Plan.pdf', mime: 'application/pdf' });
  });

  it('exports a Drawing to PNG', async () => {
    const { fn } = fetcher([jsonOf({ name: 'Sketch', mimeType: 'application/vnd.google-apps.drawing' }), new Response(new Uint8Array([7]))]);

    expect(await downloadFile(CloudProvider.Drive, 'at', 'd3', fn)).toMatchObject({ name: 'Sketch.png', mime: 'image/png' });
  });

  it('refuses a Form', async () => {
    const { fn } = fetcher([jsonOf({ name: 'Survey', mimeType: form.mimeType })]);

    expect(await downloadFile(CloudProvider.Drive, 'at', 'd2', fn)).toBeNull();
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

  it('puts bytes at the Drive root when no folder is open', async () => {
    const { fn, seen } = fetcher([jsonOf({ id: 'g1' })]);

    await uploadFile(CloudProvider.Drive, 'at', { folder: '', name: 'out.png', mime: 'image/png', bytes: new Uint8Array([1]) }, fn);

    const sent = await (seen[0].init?.body as Blob).text();
    expect(sent).toContain('"parents":["root"]');
  });
});

describe('revokeAccess', () => {
  it('asks Google to revoke the token', async () => {
    const { fn, seen } = fetcher([new Response('{}')]);

    expect(await revokeAccess(CloudProvider.Drive, 'rt', fn)).toBe(true);

    expect(seen[0].url).toBe('https://oauth2.googleapis.com/revoke');
    expect(String(seen[0].init?.body)).toBe('token=rt');
  });

  it('asks Dropbox to revoke the access token it is called with', async () => {
    const { fn, seen } = fetcher([new Response('null')]);

    expect(await revokeAccess(CloudProvider.Dropbox, 'at', fn)).toBe(true);

    expect(seen[0].url).toBe('https://api.dropboxapi.com/2/auth/token/revoke');
    expect((seen[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer at');
  });

  it('answers false when the provider refuses or is unreachable', async () => {
    expect(await revokeAccess(CloudProvider.Drive, 'x', fetcher([new Response('no', { status: 400 })]).fn)).toBe(false);
    expect(await revokeAccess(CloudProvider.Dropbox, 'x', (async () => Promise.reject(new Error('offline'))) as unknown as typeof fetch)).toBe(false);
  });
});
