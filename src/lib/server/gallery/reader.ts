import type { RequestEvent } from '@sveltejs/kit';
import { createAnonDb, type Db } from '$lib/server/db/client';

export type GalleryReader = { db: Db; userId: string | null };

export async function galleryReader(locals: RequestEvent['locals']): Promise<GalleryReader> {
  const { user } = await locals.safeGetSession();
  const db = user ? await locals.db() : null;
  return db && user ? { db, userId: user.id } : { db: createAnonDb(), userId: null };
}
