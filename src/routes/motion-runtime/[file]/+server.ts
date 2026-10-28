import { error } from '@sveltejs/kit';
import { chunkByFile, chunkByName } from '@feega/motion-core/motion/hyperframes/runtime-chunks';
import type { RequestHandler } from './$types';

const SCRIPT_HEADERS = { 'content-type': 'text/javascript; charset=utf-8', 'access-control-allow-origin': '*' };
const IMMUTABLE = 'public, max-age=31536000, s-maxage=31536000, immutable';
const OTHER_BUILD = 'public, max-age=300, s-maxage=300';

const script = (code: string, cache: string) => new Response(code, { headers: { ...SCRIPT_HEADERS, 'cache-control': cache } });

export const GET: RequestHandler = ({ params }) => {
  const exact = chunkByFile(params.file);
  if (exact !== null) {
    return script(exact, IMMUTABLE);
  }

  const sameName = chunkByName(params.file);
  if (sameName === null) {
    throw error(404, 'No such runtime file');
  }
  return script(sameName, OTHER_BUILD);
};
