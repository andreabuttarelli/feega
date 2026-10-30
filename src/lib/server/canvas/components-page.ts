import type { Db } from '$lib/server/db/client';
import { createCanvas, listCanvases, listNodes, type CanvasNodeRecord } from '$lib/server/repos/canvas';
import { COMPONENTS_PAGE } from '$lib/canvas/components-page';
import { placeFigmaPlan, type FrameStore } from '$lib/server/motion/move-element';
import type { ComponentsPage } from '$lib/server/url-import/import-url';
import { componentPages } from '$lib/server/url-import/component-sheet';
import { homedAt } from '$lib/motion/canvas-components';
import type { NewId } from '$lib/motion/main-component';
import type { PlanItem } from '$lib/canvas/figma/figma-doc';
import { Destination } from '$lib/canvas/figma/scene';
import { FrameKind } from '$lib/canvas/motion-node';

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

export async function componentsPage(db: Db, scope: Scope): Promise<ComponentsPage> {
  const canvasId = await componentsCanvas(db, scope);
  const nodes = await listNodes(db, { orgId: scope.orgId, canvasId });
  return { place: { projectId: scope.projectId, canvasId }, at: belowAll(nodes) };
}

export type HomedOutcome = { moved: string[]; setIds: string[] };

const NOTHING: HomedOutcome = { moved: [], setIds: [] };

const HOMED_SUMMARY = 'Moved the main to the Components page';

export async function homeComponents(store: FrameStore, page: () => Promise<ComponentsPage>, nodeId: string, newId: NewId): Promise<HomedOutcome> {
  const frame = await store.read(nodeId);
  if (!frame) {
    return NOTHING;
  }
  const homeless = Object.entries(frame.doc.comps).filter(([, c]) => c.component && !c.component.home);
  if (!homeless.length) {
    return NOTHING;
  }

  const where = await page();
  if (where.place.canvasId === frame.canvasId) {
    return NOTHING;
  }

  const item: PlanItem = { destination: Destination.Frame, doc: frame.doc, size: { width: frame.doc.width, height: frame.doc.height }, centre: { x: 0, y: 0 }, name: COMPONENTS_PAGE, kind: FrameKind.Frame, images: [] };
  const { sets, homes } = componentPages([item], newId);
  const placed = await placeFigmaPlan(store, where.place, { items: sets, skipped: [], fileKey: null }, where.at);
  const byComp = Object.fromEntries(Object.entries(homes[0] ?? {}).flatMap(([compId, set]) => (placed.frameIds[set] ? [[compId, placed.frameIds[set]]] : [])));
  await store.write(nodeId, frame.version, homedAt(frame.doc, byComp), HOMED_SUMMARY);
  return { moved: Object.keys(byComp), setIds: placed.frameIds };
}
