export type CanvasRoute = { projectId: string; canvasId: string };

export function canvasActionUrl(route: CanvasRoute, action: string): string {
  return `/p/${route.projectId}/c/${route.canvasId}?/${action}`;
}
