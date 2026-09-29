import type { Db } from '$lib/server/db/client';
import { createCanvas, deleteCanvas, listCanvases, renameCanvas, type Canvas } from '$lib/server/repos/canvas';

const UNTITLED_PREFIX = 'Untitled canvas ';

export enum CanvasRemoval {
  Removed = 'removed',
  LastCanvas = 'last_canvas'
}

export type RemovalResult = { outcome: CanvasRemoval.Removed; nextCanvasId: string } | { outcome: CanvasRemoval.LastCanvas };

export function nextCanvasName(existing: string[]): string {
  const taken = existing
    .filter((name) => name.startsWith(UNTITLED_PREFIX))
    .map((name) => Number(name.slice(UNTITLED_PREFIX.length)))
    .filter(Number.isInteger);

  return `${UNTITLED_PREFIX}${Math.max(0, ...taken) + 1}`;
}

export async function openNewCanvas(db: Db, scope: { orgId: string; projectId: string }): Promise<Canvas> {
  const canvases = await listCanvases(db, scope);
  const name = nextCanvasName(canvases.map((c) => c.name));
  return createCanvas(db, { ...scope, name });
}

export async function renameCanvasTo(db: Db, input: { orgId: string; canvasId: string; name: string }): Promise<boolean> {
  const name = input.name.trim();
  if (!name) {
    return false;
  }

  const renamed = await renameCanvas(db, { ...input, name });
  return renamed !== null;
}

export async function removeCanvas(
  db: Db,
  input: { orgId: string; projectId: string; canvasId: string }
): Promise<RemovalResult> {
  const canvases = await listCanvases(db, { orgId: input.orgId, projectId: input.projectId });
  const remaining = canvases.find((c) => c.id !== input.canvasId);
  if (!remaining) {
    return { outcome: CanvasRemoval.LastCanvas };
  }

  await deleteCanvas(db, { orgId: input.orgId, canvasId: input.canvasId });
  return { outcome: CanvasRemoval.Removed, nextCanvasId: remaining.id };
}
