import { error } from '@sveltejs/kit';
import { readEmbedAsset } from '$lib/server/motion/embed';
import type { RequestHandler } from './$types';

const PARTIAL_CONTENT = 206;
const RANGE = /^bytes=(\d*)-(\d*)$/;
const ASSET_HEADERS = { 'cache-control': 'public, max-age=31536000, s-maxage=31536000, immutable', 'access-control-allow-origin': '*', 'accept-ranges': 'bytes' };

function slice(range: string | null, size: number): { start: number; end: number } | null {
  const match = range ? RANGE.exec(range) : null;
  if (!match || (match[1] === '' && match[2] === '')) {
    return null;
  }
  if (match[1] === '') {
    return { start: Math.max(0, size - Number(match[2])), end: size - 1 };
  }
  return { start: Number(match[1]), end: Math.min(size - 1, match[2] === '' ? size - 1 : Number(match[2])) };
}

export const GET: RequestHandler = async ({ params, fetch, request }) => {
  const asset = await readEmbedAsset(fetch, params.id, params.hash);
  if (asset === null) {
    throw error(404, 'This asset is not published');
  }

  const headers = { ...ASSET_HEADERS, 'content-type': asset.type };
  const part = slice(request.headers.get('range'), asset.bytes.length);
  if (!part) {
    return new Response(asset.bytes, { headers });
  }
  return new Response(asset.bytes.subarray(part.start, part.end + 1), {
    status: PARTIAL_CONTENT,
    headers: { ...headers, 'content-range': `bytes ${part.start}-${part.end}/${asset.bytes.length}` }
  });
};
