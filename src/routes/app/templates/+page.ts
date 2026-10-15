import type { PageLoad } from './$types';
import { loadPage } from '$lib/dashboard/api';
import { DashboardPage } from '$lib/dashboard/pages';
import type { TemplatesData } from '$lib/server/dashboard/pages/templates';

export const load: PageLoad = ({ url, depends }) => loadPage<TemplatesData>(DashboardPage.Templates, url, depends);
