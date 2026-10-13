export enum SignInError {
  OAuth = 'oauth',
  Link = 'link'
}

export const SIGN_IN_ERROR_PARAM = 'error';

const KNOWN = new Set<string>(Object.values(SignInError));

export function signInErrorIn(url: URL): SignInError | null {
  const value = url.searchParams.get(SIGN_IN_ERROR_PARAM) ?? '';
  return KNOWN.has(value) ? (value as SignInError) : null;
}
