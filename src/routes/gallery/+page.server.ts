import type { PageServerLoad } from './$types';
import { galleryReader } from '$lib/server/gallery/reader';
import { listGallery } from '$lib/server/repos/gallery';
import { gallerySearchSchema } from '$lib/gallery/model';

export const load: PageServerLoad = async ({ locals, url }) => {
  const parsed = gallerySearchSchema.safeParse(Object.fromEntries(url.searchParams));
  const search = parsed.success ? parsed.data : gallerySearchSchema.parse({});
  const { db, userId } = await galleryReader(locals);
  return { cards: await listGallery(db, search), search, signedIn: userId !== null };
};
