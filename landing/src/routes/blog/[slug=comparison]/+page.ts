import { COMPARISONS } from '$lib/site/compare';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => Object.keys(COMPARISONS).map((slug) => ({ slug }));

export const load: PageLoad = ({ params }) => ({ slug: params.slug, page: COMPARISONS[params.slug] });
