import { describe, expect, it } from 'vitest';
import { accountOfBody } from './account';
import { SignInClient, SignInEnd, signIn, signInFromUri } from './sign-in';

const jwt = `h.${Buffer.from(JSON.stringify({ sub: 'u1', email: 'a@b.co' })).toString('base64url')}.s`;
const tokens = { access_token: jwt, refresh_token: 'r', expires_at: 99 };

function start(timeoutMs = 5000) {
  const abort = new AbortController();
  const opened = Promise.withResolvers<URL>();
  const outcome = signIn({ appUrl: 'https://oh.feega.app', openBrowser: (url) => opened.resolve(new URL(url)), timeoutMs, newState: () => 'app.s1', signal: abort.signal });
  const post = async (state: string, extra: object = tokens) => {
    const url = await opened.promise;
    return fetch(`http://127.0.0.1:${url.searchParams.get('cli_port')}/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...extra, state }) });
  };
  return { outcome, opened: opened.promise, post, abort };
}

describe('signIn', () => {
  it('apre il callback del sito con porta e state', async () => {
    const run = start();
    const url = await run.opened;
    expect(`${url.origin}${url.pathname}`).toBe('https://oh.feega.app/cli/callback');
    expect(url.searchParams.get('cli_state')).toBe('app.s1');
    run.abort.abort();
    await run.outcome;
  });

  it('con lo state giusto restituisce l account e chiude il server', async () => {
    const run = start();
    const res = await run.post('app.s1');
    expect(res.status).toBe(200);
    expect(await run.outcome).toEqual({ end: SignInEnd.Done, account: accountOfBody(tokens) });
    await expect(run.post('app.s1')).rejects.toThrow();
  });

  it('uno state sbagliato viene rifiutato e il login resta in attesa', async () => {
    const run = start();
    expect((await run.post('evil')).status).toBe(400);
    expect((await run.post('app.s1')).status).toBe(200);
    expect((await run.outcome).end).toBe(SignInEnd.Done);
  });

  it('un corpo senza token valido viene rifiutato', async () => {
    const run = start();
    expect((await run.post('app.s1', { access_token: 'x' })).status).toBe(400);
    run.abort.abort();
    expect((await run.outcome).end).toBe(SignInEnd.Cancelled);
  });

  it('scade dopo il timeout', async () => {
    const run = start(30);
    expect((await run.outcome).end).toBe(SignInEnd.Timeout);
  });

  it('annullare chiude il listener', async () => {
    const run = start();
    await run.opened;
    run.abort.abort();
    expect((await run.outcome).end).toBe(SignInEnd.Cancelled);
    await expect(run.post('app.s1')).rejects.toThrow();
  });

  it.each([
    [undefined, 'app.'],
    [SignInClient.Extension, 'app.'],
    [SignInClient.Desktop, 'desktop.']
  ])('lo state generato per il client %s inizia con %s e il login lo accetta', async (client, prefix) => {
    const abort = new AbortController();
    const opened = Promise.withResolvers<URL>();
    const outcome = signIn({ openBrowser: (url) => opened.resolve(new URL(url)), signal: abort.signal, client });
    const url = await opened.promise;
    const state = url.searchParams.get('cli_state') as string;
    expect(state.startsWith(prefix)).toBe(true);
    const query = new URLSearchParams({ ...tokens, expires_at: '99', state }).toString();
    expect(signInFromUri(query)).toBe(true);
    expect((await outcome).end).toBe(SignInEnd.Done);
  });

  it('risponde anche su ::1, dove localhost puo risolvere', async () => {
    const run = start();
    const url = await run.opened;
    const port = url.searchParams.get('cli_port');
    const res = await fetch(`http://[::1]:${port}/session`, { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    run.abort.abort();
    await run.outcome;
  });

  it('il preflight dichiara origine, metodi, header e rete privata', async () => {
    const run = start();
    const url = await run.opened;
    const res = await fetch(`http://127.0.0.1:${url.searchParams.get('cli_port')}/session`, { method: 'OPTIONS', headers: { Origin: 'https://oh.feega.app' } });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://oh.feega.app');
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
    expect(res.headers.get('access-control-allow-headers')).toBe('Content-Type');
    expect(res.headers.get('access-control-allow-private-network')).toBe('true');
    expect(res.headers.get('vary')).toBe('Origin');
    run.abort.abort();
    await run.outcome;
  });

  it('accetta l origine www dello stesso sito', async () => {
    const run = start();
    const url = await run.opened;
    const res = await fetch(`http://127.0.0.1:${url.searchParams.get('cli_port')}/session`, { method: 'OPTIONS', headers: { Origin: 'https://www.oh.feega.app' } });
    expect(res.headers.get('access-control-allow-origin')).toBe('https://www.oh.feega.app');
    run.abort.abort();
    await run.outcome;
  });

  it('un URI con lo state giusto completa il login senza listener', async () => {
    const run = start();
    await run.opened;
    const query = new URLSearchParams({ ...tokens, expires_at: '99', state: 'app.s1' }).toString();
    expect(signInFromUri(query)).toBe(true);
    expect(await run.outcome).toEqual({ end: SignInEnd.Done, account: accountOfBody(tokens) });
  });

  it('un URI con lo state sbagliato viene rifiutato', async () => {
    const run = start();
    await run.opened;
    expect(signInFromUri(new URLSearchParams({ ...tokens, expires_at: '99', state: 'evil' }).toString())).toBe(false);
    run.abort.abort();
    await run.outcome;
  });
});
