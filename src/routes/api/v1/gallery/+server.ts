import { json } from '@sveltejs/kit';
import { createAnonDb } from '$lib/server/db/client';
import { listGallery } from '$lib/server/repos/gallery';
import { cardView } from '$lib/server/gallery/service';
import { gallerySearchSchema } from '$lib/gallery/model';
import type { RequestHandler } from './$types';

const HTTP_BAD_REQUEST = 400;

export const GET: RequestHandler = async ({ url }) => {
  const search = gallerySearchSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!search.success) {
    return json({ error: 'invalid_search', detail: search.error.issues[0]?.message }, { status: HTTP_BAD_REQUEST });
  }
  const cards = await listGallery(createAnonDb(), search.data);
  return json({ items: cards.map((card) => cardView(card, url.origin)) });
};
