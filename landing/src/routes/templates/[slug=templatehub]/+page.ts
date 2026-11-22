import { HUB_SLUGS, categoryOfSlug } from '$lib/site/templates/paths';
import type { HubFramework } from '$lib/site/templates/template';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => HUB_SLUGS.map((slug) => ({ slug }));

export const load: PageLoad = ({ params }) => {
  const category = categoryOfSlug(params.slug);

  return category ? { category, framework: undefined } : { category: undefined, framework: params.slug as HubFramework };
};
