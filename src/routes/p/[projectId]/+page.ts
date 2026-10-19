import type { PageLoad } from './$types';
import { loadApiData } from '$lib/api/page-action';

export const load: PageLoad = ({ params }) => loadApiData<Record<string, never>>(`/api/v1/projects/${params.projectId}/home`);
