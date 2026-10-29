import type { Db } from '$lib/server/db/client';
import { listCanvases, listMotionNodes } from '$lib/server/repos/canvas';
import { readHead } from '$lib/server/repos/motion-revisions';
import { componentGroups, componentSlice } from '$lib/motion/canvas-components';
import type { CanvasComponents } from '$lib/canvas/project-components';
import type { MotionDoc } from '@feega/motion-core/motion/doc';

type Scope = { orgId: string; projectId: string };

const FRAME_NAME = 'Frame';

const posterOf = (projectId: string, canvasId: string, data: Record<string, unknown>): string | null =>
  typeof data.posterAssetId === 'string' ? `/p/${projectId}/c/${canvasId}/assets/${data.posterAssetId}` : null;

export async function listProjectComponents(db: Db, scope: Scope): Promise<CanvasComponents[]> {
  const [canvases, frames] = await Promise.all([listCanvases(db, scope), listMotionNodes(db, scope)]);

  const docs = await Promise.all(
    frames.map(async (frame) => ({ frame, head: await readHead(db, { orgId: scope.orgId, nodeId: frame.id }) }))
  );

  return canvases.flatMap((canvas) => {
    const components = docs
      .filter(({ frame, head }) => frame.canvasId === canvas.id && head)
      .flatMap(({ frame, head }) =>
        componentGroups([{ id: frame.id, doc: head!.doc }]).map((group) => ({ ...group, thumb: posterOf(scope.projectId, canvas.id, frame.data), frameName: frame.displayName ?? FRAME_NAME, revision: head!.version }))
      );
    return components.length ? [{ canvasId: canvas.id, canvasName: canvas.name, components }] : [];
  });
}

export async function readComponentSource(db: Db, scope: Scope & { frameId: string; compId: string }): Promise<MotionDoc | null> {
  const frames = await listMotionNodes(db, scope);
  if (!frames.some((frame) => frame.id === scope.frameId)) {
    return null;
  }

  const head = await readHead(db, { orgId: scope.orgId, nodeId: scope.frameId });
  if (!head?.doc.comps[scope.compId]?.component) {
    return null;
  }
  return componentSlice(head.doc, scope.compId);
}
