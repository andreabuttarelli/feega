import type { RequestHandler } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { isThumbnailPreset } from '$lib/server/media-thumbnails';
import { REFERENCE_REDIRECT_MAX_AGE_S, signReferenceImages } from '$lib/server/repos/reference-images';

const HTTP_SEE_OTHER = 303;
const HTTP_FOUND = 302;
const HTTP_NOT_FOUND = 404;
const HTTP_SERVER_ERROR = 500;

export const GET: RequestHandler = async ({ params, locals, url }) => {
  const { session, user } = await locals.safeGetSession();
  if (!session || !user) {
    throw redirect(HTTP_SEE_OTHER, '/login');
  }

  const preset = url.searchParams.get('preset');
  const path = params.path ?? '';
  if (!path || !isThumbnailPreset(preset)) {
    throw error(HTTP_NOT_FOUND, 'Reference image not found');
  }

  const db = await locals.db();
  if (!db) {
    throw error(HTTP_SERVER_ERROR, 'session without client');
  }

  const signed = (await signReferenceImages(db, [path], preset)).get(path);
  if (!signed) {
    throw error(HTTP_NOT_FOUND, 'Reference image not found');
  }

  return new Response(null, {
    status: HTTP_FOUND,
    headers: { Location: signed, 'Cache-Control': `private, max-age=${REFERENCE_REDIRECT_MAX_AGE_S}` }
  });
};
