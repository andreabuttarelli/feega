import { beforeEach, describe, expect, it, vi } from 'vitest';

const createConfirmedAccount = vi.fn();
const sendPasswordReset = vi.fn();
vi.mock('$lib/server/auth/accounts', async (original) => ({ ...(await original<object>()), createConfirmedAccount, sendPasswordReset }));

const signup = await import('./signup/+server');
const reset = await import('./reset/+server');

async function post(handler: unknown, path: string, body: unknown) {
  const url = new URL(`https://feega.test/api/v1/auth/${path}`);
  const request = new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const res = await (handler as (e: unknown) => Promise<Response>)({ request, url });
  return { status: res.status, body: await res.json() };
}

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/auth/signup: the sign-up action, for a client that signs in itself', () => {
  it('creates the confirmed account the action creates', async () => {
    createConfirmedAccount.mockResolvedValue(null);

    expect(await post(signup.POST, 'signup', { email: ' Ada@X.it ', password: 'secret1' })).toEqual({ status: 201, body: { created: true } });
    expect(createConfirmedAccount).toHaveBeenCalledWith('ada@x.it', 'secret1');
  });

  it('answers a refusal with the codes the login page already shows', async () => {
    createConfirmedAccount.mockResolvedValue({ errorCode: 'emailExists' });

    expect(await post(signup.POST, 'signup', { email: 'ada@x.it', password: 'secret1' })).toEqual({ status: 400, body: { errorCode: 'emailExists', email: 'ada@x.it' } });
  });
});

describe('POST /api/v1/auth/reset: the reset action', () => {
  it('sends the reset from the hosted origin and always says sent', async () => {
    expect(await post(reset.POST, 'reset', { email: 'ada@x.it', locale: 'it', invite: 'tok' })).toEqual({ status: 200, body: { reset: true, email: 'ada@x.it' } });
    expect(sendPasswordReset).toHaveBeenCalledWith({ email: 'ada@x.it', locale: 'it', base: 'https://feega.test', inviteToken: 'tok' });
  });

  it('refuses a malformed email without sending', async () => {
    expect(await post(reset.POST, 'reset', { email: 'nope' })).toEqual({ status: 400, body: { errorCode: 'invalidEmail', email: 'nope' } });
    expect(sendPasswordReset).not.toHaveBeenCalled();
  });
});
