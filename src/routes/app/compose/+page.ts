import type { PageLoad } from './$types';
import { loadPage } from '$lib/dashboard/api';
import { DashboardPage } from '$lib/dashboard/pages';
import type { ComposeData } from '$lib/server/dashboard/pages/compose';

export const load: PageLoad = ({ url, depends }) => loadPage<ComposeData>(DashboardPage.Compose, url, depends);
