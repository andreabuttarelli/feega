import type { PageLoad } from './$types';
import { loadCanvas } from '$lib/canvas/canvas-api';
import type { CanvasPageData } from '$lib/server/canvas/canvas-page';

export const ssr = false;

export const load: PageLoad = ({ params, url }) => loadCanvas<CanvasPageData>(params, url);
