import { describe, expect, it, vi } from 'vitest';
import { exchangeIdToken, forwardName, SUPABASE_URL } from './exchange';
import { appleSignIn } from './flow';
import { parseAvailability, parseHelperOutput } from './helper-output';
import { hashNonce, newNonce } from './nonce';
import { SignInMethod, appleFlag, resolveMethod } from './method';

const jwt = `h.${Buffer.from(JSON.stringify({ sub: 'u1', email: 'a@b.co' })).toString('base64url')}.s`;
const session = { access_token: jwt, refresh_token: 'r', expires_at: 99 };

const okResponse = (body: object) => ({ ok: true, status: 200, json: async () => body }) as Response;

const lastCall = (fetcher: ReturnType<typeof vi.fn>) => fetcher.mock.calls[0] as unknown as [string, RequestInit];

describe('nonce', () => {
  it('is random and hashes to lowercase hex sha-256', () => {
    expect(newNonce()).not.toBe(newNonce());
    expect(newNonce()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashNonce('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('method table', () => {
  const base = { platform: 'darwin', flag: true, available: true };

  it('mac with the flag and an available helper uses AppleNative', () => {
    expect(resolveMethod(base)).toBe(SignInMethod.AppleNative);
  });

  it.each([{ ...base, platform: 'win32' }, { ...base, platform: 'linux' }, { ...base, flag: false }, { ...base, available: false }])('everything else uses Browser %#', (input) => {
    expect(resolveMethod(input)).toBe(SignInMethod.Browser);
  });

  it('the flag is on only by env FEEGA_APPLE_NATIVE=1', () => {
    expect(appleFlag({ FEEGA_APPLE_NATIVE: '1' })).toBe(true);
    expect(appleFlag({})).toBe(false);
    expect(appleFlag({ FEEGA_APPLE_NATIVE: '0' })).toBe(false);
  });
});

describe('helper output', () => {
  it('parses a credential', () => {
    const line = JSON.stringify({ identityToken: 't', authorizationCode: 'c', user: 'u', givenName: 'A', familyName: 'B', email: 'a@b.co' });

    expect(parseHelperOutput(line)).toEqual({ ok: true, credential: { identityToken: 't', authorizationCode: 'c', user: 'u', givenName: 'A', familyName: 'B', email: 'a@b.co' } });
  });

  it('keeps names absent when Apple omits them', () => {
    const parsed = parseHelperOutput(JSON.stringify({ identityToken: 't', authorizationCode: 'c', user: 'u' }));

    expect(parsed).toMatchObject({ ok: true, credential: { givenName: null, familyName: null, email: null } });
  });

  it('parses an error', () => {
    expect(parseHelperOutput('{"error":{"code":"not_entitled","message":"x"}}')).toEqual({ ok: false, error: { code: 'not_entitled', message: 'x' } });
  });

  it('turns garbage and empty output into an error', () => {
    expect(parseHelperOutput('not json')).toMatchObject({ ok: false, error: { code: 'bad_output' } });
    expect(parseHelperOutput('')).toMatchObject({ ok: false, error: { code: 'bad_output' } });
    expect(parseHelperOutput('{"identityToken":""}')).toMatchObject({ ok: false, error: { code: 'bad_output' } });
  });

  it('availability is true only when the helper says so', () => {
    expect(parseAvailability('{"available":true}')).toBe(true);
    expect(parseAvailability('{"error":{"code":"not_entitled","message":""}}')).toBe(false);
    expect(parseAvailability('')).toBe(false);
  });
});

describe('token exchange', () => {
  it('posts the id_token grant with the raw nonce', async () => {
    const fetcher = vi.fn(async () => okResponse(session));

    const account = await exchangeIdToken({ identityToken: 'tok', rawNonce: 'raw', fetcher });

    const [url, init] = lastCall(fetcher);
    expect(url).toBe(`${SUPABASE_URL}/auth/v1/token?grant_type=id_token`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ provider: 'apple', id_token: 'tok', nonce: 'raw' });
    expect((init.headers as Record<string, string>).apikey).toBeTruthy();
    expect(account).toMatchObject({ access_token: jwt, user: { id: 'u1', email: 'a@b.co' } });
  });

  it('returns null on a rejected exchange', async () => {
    const fetcher = vi.fn(async () => ({ ok: false, status: 400, json: async () => ({}) }) as Response);

    expect(await exchangeIdToken({ identityToken: 'tok', rawNonce: 'raw', fetcher })).toBeNull();
  });
});

describe('name forwarding', () => {
  it('puts given, family and full name in user metadata when present', async () => {
    const fetcher = vi.fn(async () => okResponse({}));

    await forwardName({ accessToken: 'at', givenName: 'Ada', familyName: 'Lovelace', fetcher });

    const [url, init] = lastCall(fetcher);
    expect(url).toBe(`${SUPABASE_URL}/auth/v1/user`);
    expect(init.method).toBe('PUT');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer at');
    expect(JSON.parse(init.body as string)).toEqual({ data: { given_name: 'Ada', family_name: 'Lovelace', full_name: 'Ada Lovelace' } });
  });

  it('sends nothing when Apple returned no name', async () => {
    const fetcher = vi.fn(async () => okResponse({}));

    await forwardName({ accessToken: 'at', givenName: null, familyName: null, fetcher });

    expect(fetcher).not.toHaveBeenCalled();
  });

  it('sends only the part that exists', async () => {
    const fetcher = vi.fn(async () => okResponse({}));

    await forwardName({ accessToken: 'at', givenName: 'Ada', familyName: null, fetcher });

    expect(JSON.parse(lastCall(fetcher)[1].body as string)).toEqual({ data: { given_name: 'Ada', full_name: 'Ada' } });
  });
});

describe('apple flow', () => {
  const credential = { identityToken: 'tok', authorizationCode: 'c', user: 'u', givenName: 'Ada', familyName: null, email: null };

  it('hashes the nonce for Apple and sends the raw one to Supabase', async () => {
    const seen: string[] = [];
    const helper = { available: async () => true, signIn: async (hashed: string) => (seen.push(hashed), { ok: true as const, credential }) };
    const fetcher = vi.fn(async () => okResponse(session));

    const account = await appleSignIn(helper, new AbortController().signal, fetcher);

    const exchange = JSON.parse(lastCall(fetcher)[1].body as string);
    expect(hashNonce(exchange.nonce)).toBe(seen[0]);
    expect(account?.user.email).toBe('a@b.co');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('stops at a helper error without calling Supabase', async () => {
    const helper = { available: async () => true, signIn: async () => ({ ok: false as const, error: { code: 'cancelled', message: '' } }) };
    const fetcher = vi.fn();

    expect(await appleSignIn(helper, new AbortController().signal, fetcher)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
