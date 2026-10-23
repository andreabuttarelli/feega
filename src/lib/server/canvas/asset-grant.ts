import { ASSET_GRANT_PARAM, isGrantable } from '$lib/canvas/asset-url';
import { openSecret, sealSecret } from '$lib/server/secrets/seal';

const KEY_CONTEXT = 'feega:asset-grant';

export const sealAssetGrant = (token: string): string => sealSecret(KEY_CONTEXT, token);

export const openAssetGrant = (grant: string): string | null => openSecret(KEY_CONTEXT, grant);

export function grantBearerOf(request: Request): string | null {
  const url = new URL(request.url);
  const grant = url.searchParams.get(ASSET_GRANT_PARAM);
  if (request.method !== 'GET' || !grant || !isGrantable(url.pathname)) {
    return null;
  }
  return openAssetGrant(grant);
}
