import type { PageLoad } from './$types';
import { loadCanvas } from '$lib/dashboard/api';
import type { CanvasPageData } from '$lib/server/canvas/canvas-page';

export const ssr = false;

export const load: PageLoad = ({ params, url, depends }) => loadCanvas<CanvasPageData>(params, url, depends);
