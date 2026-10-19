import type { LayoutLoad } from './$types';
import { loadApiData } from '$lib/api/page-action';
import { CANVAS_LIST_DEPENDENCY } from '$lib/canvas/canvas-list';
import type { ProjectShell } from '$lib/server/projects/project-shell';

export const ssr = false;

export const load: LayoutLoad = ({ params, depends }) => {
  depends('app:credits', CANVAS_LIST_DEPENDENCY);
  return loadApiData<ProjectShell>(`/api/v1/projects/${params.projectId}/shell`);
};
