import type { PageLoad } from './$types';
import { loadPageData } from '$lib/api/page-action';
import type { PageData } from '$lib/server/project-pages/assets';

export const load: PageLoad = ({ url }) => loadPageData<PageData>(url);
