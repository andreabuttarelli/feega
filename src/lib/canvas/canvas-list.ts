import { applyAction } from '$app/forms';
import { invalidate } from '$app/navigation';
import { postCanvasAction } from './canvas-api';
import { canvasRouteOf } from './canvas-action-url';

export const CANVAS_LIST_DEPENDENCY = 'app:canvases';

export enum CanvasAction {
  New = 'new_canvas',
  Rename = 'rename_canvas',
  Delete = 'delete_canvas',
  RenameProject = 'rename_project'
}

export async function submitCanvasAction(canvasHref: string, action: CanvasAction, fields: Record<string, string> = {}): Promise<void> {
  const route = canvasRouteOf(canvasHref);
  if (!route) {
    return;
  }

  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    body.set(key, value);
  }

  const result = await postCanvasAction(route, action, body);
  if (result.type === 'success') {
    await invalidate(CANVAS_LIST_DEPENDENCY);
    return;
  }
  await applyAction(result);
}

export async function renameProjectAction(canvasHref: string, name: string): Promise<void> {
  await submitCanvasAction(canvasHref, CanvasAction.RenameProject, { name });
}
