import { signInFromUri } from '../../../inspect/src/host/sign-in';

export const SCHEME = 'feega';

const SIGN_IN_HOST = 'signin';

export const signInQueryOf = (raw: string): string | null => {
  try {
    const url = new URL(raw);
    return url.protocol === `${SCHEME}:` && url.hostname === SIGN_IN_HOST ? url.search.slice(1) : null;
  } catch {
    return null;
  }
};

export const acceptDeepLink = (raw: string): boolean => {
  const query = signInQueryOf(raw);
  return query !== null && signInFromUri(query);
};

export const linkOfArgv = (argv: string[]): string | null => argv.find((arg) => arg.startsWith(`${SCHEME}://`)) ?? null;
