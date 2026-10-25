import code from 'virtual:motion-player';
import type { RequestHandler } from './$types';

const PLAYER_HEADERS = { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=300', 'access-control-allow-origin': '*' };

export const GET: RequestHandler = () => new Response(code, { headers: PLAYER_HEADERS });
