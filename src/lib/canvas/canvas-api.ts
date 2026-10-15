import type { ActionResult } from '@sveltejs/kit';
import { apiCall } from '$lib/api/client';
import { canvasActionOf, canvasLoadOf } from './canvas-answers';
import type { CanvasRoute } from './canvas-action-url';

const ACTION_PARAM = 'action';

function canvasPath(route: CanvasRoute): string {
  return `/api/v1/projects/${route.projectId}/canvases/${route.canvasId}`;
}

export async function loadCanvas<T>(route: CanvasRoute, url: URL): Promise<T> {
  const search = url.searchParams.toString();
  const { status, body } = await apiCall(search ? `${canvasPath(route)}?${search}` : canvasPath(route));
  return canvasLoadOf(status, body) as T;
}

export async function postCanvasAction(route: CanvasRoute, action: string, form: FormData): Promise<ActionResult> {
  const query = new URLSearchParams({ [ACTION_PARAM]: action });
  const { status, body } = await apiCall(`${canvasPath(route)}?${query}`, { method: 'POST', body: form });
  return canvasActionOf(status, body);
}
