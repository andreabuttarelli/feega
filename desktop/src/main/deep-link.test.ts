import { describe, expect, it } from 'vitest';
import { SignInEnd, signIn } from '../../../inspect/src/host/sign-in';
import { acceptDeepLink, linkOfArgv, signInQueryOf } from './deep-link';

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const jwt = `${encode({ alg: 'none' })}.${encode({ sub: 'user-1', email: 'me@example.com' })}.sig`;
const linkWith = (state: string) => `feega://signin?${new URLSearchParams({ access_token: jwt, refresh_token: 'refresh', expires_at: '1999999999', state })}`;

const pendingSignIn = (state: string) => {
  const controller = new AbortController();
  const outcome = signIn({ openBrowser: () => undefined, signal: controller.signal, newState: () => state });
  return { outcome, cancel: () => controller.abort() };
};

describe('feega deep links', () => {
  it('reads the query of a signin link and ignores everything else', () => {
    expect(signInQueryOf('feega://signin?state=app.1&access_token=a')).toBe('state=app.1&access_token=a');
    expect(signInQueryOf('feega://other?state=app.1')).toBeNull();
    expect(signInQueryOf('https://oh.feega.app/signin?state=app.1')).toBeNull();
    expect(signInQueryOf('not a url')).toBeNull();
  });

  it('finds the link among the arguments of a second launch', () => {
    expect(linkOfArgv(['/app/Feega', '--flag', 'feega://signin?state=x'])).toBe('feega://signin?state=x');
    expect(linkOfArgv(['/app/Feega', '--flag'])).toBeNull();
  });

  it('completes the pending sign-in when the state matches', async () => {
    const { outcome } = pendingSignIn('app.match');
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(acceptDeepLink(linkWith('app.match'))).toBe(true);
    const result = await outcome;
    expect(result.end).toBe(SignInEnd.Done);
    expect(result.end === SignInEnd.Done && result.account.user.email).toBe('me@example.com');
  });

  it('rejects a link whose state was never issued', async () => {
    const { outcome, cancel } = pendingSignIn('app.issued');
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(acceptDeepLink(linkWith('app.forged'))).toBe(false);
    cancel();
    expect((await outcome).end).toBe(SignInEnd.Cancelled);
  });

  it('rejects a link when no sign-in is pending', () => {
    expect(acceptDeepLink(linkWith('app.nobody'))).toBe(false);
  });
});
