import type { ServerLoad as PageServerLoad } from '@sveltejs/kit';
import { signedInDb } from '$lib/server/dashboard/app-shell';
import { toolScope } from '$lib/server/dashboard/tool-scope';
import { listGallery } from '$lib/server/repos/gallery';
import { gallerySearchSchema } from '$lib/gallery/model';
import { BUILTIN_TEMPLATES } from '$lib/motion/template/builtins';
import { catalogue, posterShelf } from '$lib/motion/template/catalogue';
import { templatesIn, templateThumbnail } from '$lib/canvas/templates';
import { TemplateFamily } from '$lib/dashboard/template-families';

const GALLERY_SIZE = 8;

export const load = async (event: Parameters<PageServerLoad>[0]) => {
  const { db } = await signedInDb(event);
  const [gallery, attachProjectId] = await Promise.all([
    listGallery(db, gallerySearchSchema.parse({ limit: GALLERY_SIZE })),
    toolScope(event).then((scope) => scope.projectId, () => null)
  ]);
  const components = catalogue(BUILTIN_TEMPLATES);
  const nodeTemplates = (family: TemplateFamily.Composition | TemplateFamily.Effects) =>
    templatesIn(family).map((t) => ({ id: t.id, name: t.name, description: t.description, thumbnail: templateThumbnail(t), family }));
  return {
    components,
    posters: posterShelf(components),
    nodeTemplates: [...nodeTemplates(TemplateFamily.Composition), ...nodeTemplates(TemplateFamily.Effects)],
    gallery,
    attachProjectId
  };
};

export type TemplatesData = Awaited<ReturnType<typeof load>>;
