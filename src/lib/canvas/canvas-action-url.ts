export type CanvasRoute = { projectId: string; canvasId: string };

const CANVAS_HREF = /^\/p\/([^/]+)\/c\/([^/?#]+)/;

export function canvasRouteOf(href: string): CanvasRoute | null {
  const match = CANVAS_HREF.exec(href);
  return match ? { projectId: match[1], canvasId: match[2] } : null;
}
