import type { Db } from '$lib/server/db/client';
import { createCanvas, listCanvases, listNodes, type CanvasNodeRecord } from '$lib/server/repos/canvas';
import { COMPONENTS_PAGE } from '$lib/canvas/components-page';

type Scope = { orgId: string; projectId: string };

const GAP_PX = 240;

export function belowAll(nodes: readonly Pick<CanvasNodeRecord, 'position' | 'size'>[]): { x: number; y: number } {
  if (!nodes.length) {
    return { x: 0, y: 0 };
  }
  const left = Math.min(...nodes.map((n) => n.position.x));
  const bottom = Math.max(...nodes.map((n) => n.position.y + (n.size.height ?? 0)));
  return { x: left, y: bottom + GAP_PX };
}

export async function componentsCanvas(db: Db, scope: Scope): Promise<string> {
  const found = (await listCanvases(db, scope)).find((c) => c.name === COMPONENTS_PAGE);
  return found?.id ?? (await createCanvas(db, { ...scope, name: COMPONENTS_PAGE })).id;
}

export async function componentsPage(db: Db, scope: Scope): Promise<{ place: { projectId: string; canvasId: string }; at: { x: number; y: number } }> {
  const canvasId = await componentsCanvas(db, scope);
  const nodes = await listNodes(db, { orgId: scope.orgId, canvasId });
  return { place: { projectId: scope.projectId, canvasId }, at: belowAll(nodes) };
}
