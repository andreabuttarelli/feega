import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertPublicUrl } from '$lib/server/tool-guard';
import { registryBundle } from '$lib/server/registry-components/registry-item';
import { previewPage } from '$lib/server/registry-components/preview-page';

const BAD_REQUEST = 400;
const BAD_GATEWAY = 502;

export const GET: RequestHandler = async ({ url }) => {
  const registry = url.searchParams.get('registry') ?? '';
  if (!URL.canParse(registry)) {
    error(BAD_REQUEST, 'registry must be a URL');
  }
  await assertPublicUrl(new URL(registry)).catch(() => error(BAD_REQUEST, 'registry must be public'));

  const props = JSON.parse(url.searchParams.get('props') || '{}') as Record<string, unknown>;
  const bundle = await registryBundle(registry).catch((e: Error) => error(BAD_GATEWAY, e.message));
  return new Response(previewPage(bundle, props), { headers: { 'content-type': 'text/html; charset=utf-8' } });
};
