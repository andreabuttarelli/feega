import all from 'virtual:changelog-entries';
import { changelogPage, changelogPageCount } from '$lib/site/changelog-pages';
import type { PageServerLoad } from './$types';

const FIRST_PAGE = 1;

export const load: PageServerLoad = () => ({ entries: changelogPage(all, FIRST_PAGE), pages: changelogPageCount(all) });
