import { load as projectShell } from '$lib/server/projects/project-shell';
import { load as settingsShell } from '$lib/server/settings/shell';
import { bearerEvent, type Bearer } from '$lib/server/api/bearer-page';

function once<T>(run: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => (pending ??= run());
}

export function settingsChain(bearer: Bearer, request: Request, apiUrl: URL, pagePath: string, projectId: string) {
  const event = bearerEvent(bearer, request, apiUrl, pagePath, { projectId });
  const project = once(async () => (await projectShell(event as never)) as Record<string, unknown>);
  const layout = once(async () => (await settingsShell({ ...event, parent: project } as never)) as Record<string, unknown>);
  const parent = async () => ({ ...(await project()), ...(await layout()) });
  return { event, project, layout, page: { ...event, parent } };
}
