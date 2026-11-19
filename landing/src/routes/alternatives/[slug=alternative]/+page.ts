import { ALTERNATIVES } from '$lib/site/alternatives';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => Object.keys(ALTERNATIVES).map((slug) => ({ slug }));

export const load: PageLoad = ({ params }) => ({ slug: params.slug, page: ALTERNATIVES[params.slug] });
