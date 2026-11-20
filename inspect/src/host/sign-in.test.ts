import { describe, expect, it } from 'vitest';
import { accountOfBody } from './account';
import { SignInEnd, signIn } from './sign-in';

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
});
