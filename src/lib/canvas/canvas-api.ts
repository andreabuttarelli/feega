import type { ActionResult } from '@sveltejs/kit';
import { postPageAction } from '$lib/api/page-action';
import type { CanvasRoute } from './canvas-action-url';

export function postCanvasAction(route: CanvasRoute, action: string, form: FormData): Promise<ActionResult> {
  return postPageAction(`/p/${route.projectId}/c/${route.canvasId}`, action, form);
}
