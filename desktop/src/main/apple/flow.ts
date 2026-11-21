import { type Account } from '../../../../inspect/src/host/account';
import { exchangeIdToken, forwardName } from './exchange';
import { type AppleHelper } from './helper';
import { hashNonce, newNonce } from './nonce';

export async function appleSignIn(helper: AppleHelper, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<Account | null> {
  const rawNonce = newNonce();
  const result = await helper.signIn(hashNonce(rawNonce), signal);
  if (!result.ok) {
    return null;
  }

  const { identityToken, givenName, familyName } = result.credential;
  const account = await exchangeIdToken({ identityToken, rawNonce, fetcher });
  if (!account) {
    return null;
  }

  await forwardName({ accessToken: account.access_token, givenName, familyName, fetcher });

  return account;
}
