import type { LayoutLoad } from './$types';
import { loadDashboardShell } from '$lib/settings/api';
import type { load as shellLoad } from '$lib/server/settings/shell';

export const ssr = false;

export const load: LayoutLoad = ({ url, depends }) => loadDashboardShell<Awaited<ReturnType<typeof shellLoad>>>(url, depends);
