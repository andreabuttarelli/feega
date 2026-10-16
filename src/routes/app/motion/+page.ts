import type { PageLoad } from './$types';
import { loadPage } from '$lib/dashboard/api';
import { DashboardPage } from '$lib/dashboard/pages';
import type { MotionData } from '$lib/server/dashboard/pages/motion';

export const load: PageLoad = ({ url, depends }) => loadPage<MotionData>(DashboardPage.Motion, url, depends);
