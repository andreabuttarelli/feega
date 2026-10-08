import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { galleryReader } from '$lib/server/gallery/reader';
import { findGalleryItem } from '$lib/server/repos/gallery';
import { assetUrlMap } from '$lib/gallery/model';

const HTTP_NOT_FOUND = 404;
const CACHE_SECONDS = 300;

export const GET: RequestHandler = async ({ locals, params, setHeaders }) => {
  const { db } = await galleryReader(locals);
  const item = await findGalleryItem(db, params.id);
  if (!item) {
    throw error(HTTP_NOT_FOUND, 'Not in the gallery');
  }
  setHeaders({ 'cache-control': `public, max-age=${CACHE_SECONDS}` });
  return json({ doc: item.doc, assets: assetUrlMap(item.assets) });
};
