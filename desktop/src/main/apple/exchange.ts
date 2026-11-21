import { accountOfBody, type Account } from '../../../../inspect/src/host/account';

export const SUPABASE_URL = 'https://klnswzhhgrqvbfjzioul.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_4TwkYt0gDk2VeF57n_npzw_cFO5FMyR';

type Fetcher = typeof fetch;

const JSON_HEADERS = { 'content-type': 'application/json', apikey: SUPABASE_PUBLISHABLE_KEY };

export async function exchangeIdToken({ identityToken, rawNonce, fetcher = fetch }: { identityToken: string; rawNonce: string; fetcher?: Fetcher }): Promise<Account | null> {
  const response = await fetcher(`${SUPABASE_URL}/auth/v1/token?grant_type=id_token`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ provider: 'apple', id_token: identityToken, nonce: rawNonce })
  });
  if (!response.ok) {
    return null;
  }

  return accountOfBody(await response.json());
}

export async function forwardName({ accessToken, givenName, familyName, fetcher = fetch }: { accessToken: string; givenName: string | null; familyName: string | null; fetcher?: Fetcher }): Promise<void> {
  const full = [givenName, familyName].filter(Boolean).join(' ');
  if (!full) {
    return;
  }

  const data = { ...(givenName && { given_name: givenName }), ...(familyName && { family_name: familyName }), full_name: full };
  await fetcher(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: { ...JSON_HEADERS, authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ data })
  });
}
