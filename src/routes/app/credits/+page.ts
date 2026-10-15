import type { PageLoad } from './$types';
import { loadPage } from '$lib/dashboard/api';
import { DashboardPage } from '$lib/dashboard/pages';
import type { CreditsData } from '$lib/server/dashboard/pages/credits';

export const load: PageLoad = ({ url, depends }) => loadPage<CreditsData>(DashboardPage.Credits, url, depends);
