import type { PageLoad } from './$types';
import { loadPageData } from '$lib/api/page-action';
import type { CanvasPageData } from '$lib/server/canvas/canvas-page';

export const ssr = false;

export const load: PageLoad = ({ url }) => loadPageData<CanvasPageData>(url);
