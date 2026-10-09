import { hostMain } from '$lib/motion/interactive/host';
import { loaderConfig, loaderMain } from '$lib/motion/interactive/loader';
import type { RequestHandler } from './$types';

const LOADER_HEADERS = { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=300', 'access-control-allow-origin': '*' };

export const GET: RequestHandler = ({ url }) => {
  const script = `(${loaderMain.toString()})(window,${JSON.stringify(loaderConfig(url.origin))},${hostMain.toString()});`;
  return new Response(script, { headers: LOADER_HEADERS });
};
