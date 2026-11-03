import type { Db } from '$lib/server/db/client';
import { listCanvases, listMotionNodes, listNodes, type CanvasNodeRecord } from '$lib/server/repos/canvas';
import { COMPONENTS_PAGE } from '$lib/canvas/components-page';
import { DocNodeType } from '$lib/canvas/motion-node';
import { readHead, readHeads, type MotionHead } from '$lib/server/repos/motion-revisions';
import { componentGroups, componentSlice } from '$lib/motion/canvas-components';
import type { CanvasComponents } from '$lib/canvas/project-components';
import type { MotionDoc } from '@feega/motion-core/motion/doc';

type Scope = { orgId: string; projectId: string };

const FRAME_NAME = 'Frame';

async function framesOf(db: Db, scope: Scope): Promise<{ canvases: Awaited<ReturnType<typeof listCanvases>>; frames: CanvasNodeRecord[] }> {
  const canvases = await listCanvases(db, scope);
  const page = canvases.find((c) => c.name === COMPONENTS_PAGE);
  const [frames, sets] = await Promise.all([listMotionNodes(db, scope), page ? listNodes(db, { orgId: scope.orgId, canvasId: page.id }) : []]);
  return { canvases, frames: [...frames, ...sets.filter((n) => n.type === DocNodeType.Element)] };
}

const posterOf = (projectId: string, canvasId: string, data: Record<string, unknown>): string | null =>
  typeof data.posterAssetId === 'string' ? `/p/${projectId}/c/${canvasId}/assets/${data.posterAssetId}` : null;

const HEADS_PER_QUERY = 40;

const knownHead = (frame: CanvasNodeRecord): number => Number(frame.data.docHeadRevision) || 0;

async function headsOf(db: Db, orgId: string, frames: readonly CanvasNodeRecord[]): Promise<Map<string, MotionHead>> {
  const known = frames.filter((frame) => knownHead(frame) > 0).map((frame) => ({ nodeId: frame.id, version: knownHead(frame) }));
  const batches = Array.from({ length: Math.ceil(known.length / HEADS_PER_QUERY) }, (_, at) => known.slice(at * HEADS_PER_QUERY, (at + 1) * HEADS_PER_QUERY));
  const found = new Map((await Promise.all(batches.map((heads) => readHeads(db, { orgId, heads })))).flatMap((batch) => [...batch]));
  const missing = frames.filter((frame) => !found.has(frame.id));
  const rest = await Promise.all(missing.map(async (frame) => [frame.id, await readHead(db, { orgId, nodeId: frame.id })] as const));
  rest.forEach(([id, head]) => head && found.set(id, head));
  return found;
}

export async function listProjectComponents(db: Db, scope: Scope): Promise<CanvasComponents[]> {
  const { canvases, frames } = await framesOf(db, scope);

  const heads = await headsOf(db, scope.orgId, frames);
  const docs = frames.map((frame) => ({ frame, head: heads.get(frame.id) ?? null }));

  return canvases.flatMap((canvas) => {
    const inCanvas = docs.flatMap(({ frame, head }) => (frame.canvasId === canvas.id && head ? [{ frame, head }] : []));
    const byId = new Map(inCanvas.map(({ frame, head }) => [frame.id, { frame, head }]));
    const components = componentGroups(inCanvas.map(({ frame, head }) => ({ id: frame.id, doc: head.doc }))).map((group) => {
      const { frame, head } = byId.get(group.frameId)!;
      return { ...group, thumb: posterOf(scope.projectId, canvas.id, frame.data), frameName: frame.displayName ?? FRAME_NAME, revision: head.version };
    });
    return components.length ? [{ canvasId: canvas.id, canvasName: canvas.name, components }] : [];
  });
}

export async function readComponentSource(db: Db, scope: Scope & { frameId: string; compId: string }): Promise<MotionDoc | null> {
  const { frames } = await framesOf(db, scope);
  if (!frames.some((frame) => frame.id === scope.frameId)) {
    return null;
  }

  const head = await readHead(db, { orgId: scope.orgId, nodeId: scope.frameId });
  if (!head?.doc.comps[scope.compId]?.component) {
    return null;
  }
  return componentSlice(head.doc, scope.compId);
}
