import { error } from '@sveltejs/kit';
import { chunkByFile } from '$lib/motion/hyperframes/runtime-chunks';
import type { RequestHandler } from './$types';

const RUNTIME_HEADERS = { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'public, max-age=31536000, s-maxage=31536000, immutable', 'access-control-allow-origin': '*' };

export const GET: RequestHandler = ({ params }) => {
  const code = chunkByFile(params.file);
  if (code === null) {
    throw error(404, 'No such runtime file');
  }
  return new Response(code, { headers: RUNTIME_HEADERS });
};
