import type { PageLoad } from './$types';
import { loadPage } from '$lib/dashboard/api';
import { DashboardPage } from '$lib/dashboard/pages';
import type { CanvasesData } from '$lib/server/dashboard/pages/canvases';

export const load: PageLoad = ({ url, depends }) => loadPage<CanvasesData>(DashboardPage.Canvases, url, depends);
