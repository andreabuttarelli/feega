import type { ServerLoad as PageServerLoad } from '@sveltejs/kit';
import { signedInDb } from '$lib/server/dashboard/app-shell';
import { toolScope } from '$lib/server/dashboard/tool-scope';
import { listGallery } from '$lib/server/repos/gallery';
import { gallerySearchSchema } from '$lib/gallery/model';
import { BUILTIN_TEMPLATES } from '$lib/motion/template/builtins';
import { catalogue, posterShelf } from '$lib/motion/template/catalogue';

const GALLERY_SIZE = 8;

export const load: PageServerLoad = async (event) => {
  const { db } = await signedInDb(event);
  const [gallery, attachProjectId] = await Promise.all([
    listGallery(db, gallerySearchSchema.parse({ limit: GALLERY_SIZE })),
    toolScope(event).then((scope) => scope.projectId, () => null)
  ]);
  const components = catalogue(BUILTIN_TEMPLATES);
  return { components, posters: posterShelf(components), gallery, attachProjectId };
};
