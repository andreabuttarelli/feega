import { LANDING_PAGES } from '$lib/site/landing';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => Object.keys(LANDING_PAGES).map((page) => ({ page }));

export const load: PageLoad = ({ params }) => LANDING_PAGES[params.page];
