import { LANDING_PAGES } from '$lib/site/landing';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => LANDING_PAGES[params.page];
