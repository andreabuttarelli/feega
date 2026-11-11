import { GUIDES } from '$lib/site/guides';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => Object.keys(GUIDES).map((slug) => ({ slug }));

export const load: PageLoad = ({ params }) => ({ slug: params.slug, guide: GUIDES[params.slug] });
