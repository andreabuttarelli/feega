import { applyAction, deserialize } from '$app/forms';
import { invalidate } from '$app/navigation';

export const CANVAS_LIST_DEPENDENCY = 'app:canvases';

export enum CanvasAction {
  New = 'new_canvas',
  Rename = 'rename_canvas',
  Delete = 'delete_canvas'
}

export async function submitCanvasAction(canvasHref: string, action: CanvasAction, fields: Record<string, string> = {}): Promise<void> {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    body.set(key, value);
  }

  const res = await fetch(`${canvasHref}?/${action}`, { method: 'POST', body });
  const result = deserialize(await res.text());
  if (result.type === 'success') {
    await invalidate(CANVAS_LIST_DEPENDENCY);
    return;
  }
  await applyAction(result);
}

export async function renameProjectAction(canvasHref: string, name: string): Promise<void> {
  const body = new FormData();
  body.set('name', name);

  const res = await fetch(`${canvasHref}?/rename_project`, { method: 'POST', body });
  const result = deserialize(await res.text());
  if (result.type === 'success') {
    await invalidate(CANVAS_LIST_DEPENDENCY);
    return;
  }
  await applyAction(result);
}
