import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { bearerOf } from '$lib/server/api/bearer-page';
import { sealAssetGrant } from '$lib/server/canvas/asset-grant';

const MS_PER_S = 1000;

function expiryMsOf(token: string): number {
  const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { exp?: number };
  return (payload.exp ?? 0) * MS_PER_S;
}

export const GET: RequestHandler = async ({ request }) => {
  const bearer = await bearerOf(request);
  if (bearer instanceof Response) {
    return bearer;
  }
  return json({ grant: sealAssetGrant(bearer.token), expiresAt: expiryMsOf(bearer.token) });
};
