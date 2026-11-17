import { error } from '@sveltejs/kit';
import { localStore } from '$lib/server/local/local-mode';
import { resizedOnce, transformed } from '$lib/server/local/local-transform';

type Params = { bucket: string; path: string };

const NOT_FOUND = 404;
const CREATED = 201;
const RESIZES_OPEN = 2;

const sized = resizedOnce(transformed, RESIZES_OPEN);

function local() {
  const store = localStore();
  if (!store) {
    error(NOT_FOUND);
  }
  return store;
}

export const GET = async ({ params, url }: { params: Params; url: URL }) => {
  const found = local().blob(params.bucket, params.path);
  if (!found) {
    error(NOT_FOUND);
  }

  const blob = url.searchParams.has('width') ? await sized(`${params.bucket}/${params.path}`, found, url.searchParams) : found;
  return new Response(blob.bytes as BodyInit, { headers: { 'content-type': blob.contentType, 'cache-control': 'private, max-age=3600' } });
};

export const PUT = async ({ params, request }: { params: Params; request: Request }) => {
  const contentType = request.headers.get('content-type') ?? 'application/octet-stream';
  sized.forget(`${params.bucket}/${params.path}`);
  const stored = await local().db.storage.from(params.bucket).upload(params.path, new Uint8Array(await request.arrayBuffer()), { contentType, upsert: true });
  if (stored.error) {
    error(Number(stored.error.statusCode ?? 500), stored.error.message);
  }
  return new Response(JSON.stringify({ Key: `${params.bucket}/${params.path}` }), { status: CREATED, headers: { 'content-type': 'application/json' } });
};

export const POST = PUT;
