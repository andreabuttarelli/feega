import { createHash } from 'node:crypto';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import type { Db } from '$lib/server/db/client';
import { createCanvas, listCanvases, listNodes, type CanvasNodeRecord } from '$lib/server/repos/canvas';
import { COMPONENTS_PAGE } from '$lib/canvas/components-page';
import { placeFigmaPlan, type FrameStore, type StoredFrame } from '$lib/server/motion/move-element';
import type { ComponentsPage } from '$lib/server/url-import/import-url';
import { componentPages } from '$lib/server/url-import/component-sheet';
import { homedAt } from '$lib/motion/canvas-components';
import type { NewId } from '$lib/motion/main-component';
import type { PlanItem } from '$lib/canvas/figma/figma-doc';
import { Destination } from '$lib/canvas/figma/scene';
import { FrameKind } from '$lib/canvas/motion-node';
import { RevisionOutcome } from '$lib/server/repos/motion-revisions';
import type { Revision } from '$lib/motion/frame-sync';

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

const homeless = (doc: MotionDoc) => new Set(Object.entries(doc.comps).flatMap(([id, c]) => (c.component && !c.component.home ? [id] : [])));

export function mainsGained(before: MotionDoc, after: MotionDoc): boolean {
  const had = homeless(before);
  return [...homeless(after)].some((id) => !had.has(id));
}

export type HomedOutcome = { moved: string[]; setIds: string[]; homes: Record<string, string>; head: Revision | null };

const NOTHING: HomedOutcome = { moved: [], setIds: [], homes: {}, head: null };

const HOMED_SUMMARY = 'Moved the main to the Components page';

const HOMING_ATTEMPTS = 4;

const shownScale = (frame: StoredFrame): number => (frame.stage ? frame.stage.width / frame.doc.width : 1);

const scaled = (item: PlanItem, scale: number): PlanItem => ({
  ...item,
  size: { width: item.size.width * scale, height: item.size.height * scale },
  centre: { x: item.centre.x * scale, y: item.centre.y * scale }
});

export function setNodeId(sourceId: string, compId: string): string {
  const hex = createHash('sha1').update(`${sourceId}/${compId}`).digest('hex');
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const homesOf = (doc: MotionDoc): Record<string, string> => Object.fromEntries(Object.entries(doc.comps).flatMap(([id, c]) => (c.component?.home ? [[id, c.component.home]] : [])));

function keyedCreate(store: FrameStore, ids: readonly string[]): FrameStore {
  let next = 0;
  return {
    ...store,
    create: async (at, doc, shape) => {
      const id = ids[next++];
      return store.create({ ...at, id }, doc, shape).catch(async () => ((await store.read(id)) ? id : store.create(at, doc, shape)));
    }
  };
}

async function placeSets(store: FrameStore, frame: StoredFrame, where: ComponentsPage, newId: NewId): Promise<Record<string, string>> {
  const item: PlanItem = { destination: Destination.Frame, doc: frame.doc, size: { width: frame.doc.width, height: frame.doc.height }, centre: { x: 0, y: 0 }, name: COMPONENTS_PAGE, kind: FrameKind.Frame, images: [] };
  const { sets, homes } = componentPages([item], newId);
  const setOf = Object.entries(homes[0] ?? {}).filter(([compId]) => homeless(frame.doc).has(compId));
  const ids = sets.map((_, at) => setNodeId(frame.nodeId, setOf.filter(([, set]) => set === at).map(([compId]) => compId).sort()[0] ?? String(at)));
  const placedAlready = await Promise.all(ids.map(async (id) => (await store.read(id)) !== null));
  const missing = sets.flatMap((set, at) => (placedAlready[at] ? [] : [{ set, at }]));
  const scale = shownScale(frame);
  const placed = await placeFigmaPlan(keyedCreate(store, missing.map((m) => ids[m.at])), where.place, { items: missing.map((m) => scaled(m.set, scale)), skipped: [], fileKey: null }, where.at);
  const landed = ids.map((id, at) => placed.frameIds[missing.findIndex((m) => m.at === at)] ?? id);
  return Object.fromEntries(setOf.map(([compId, set]) => [compId, landed[set]]));
}

export async function homeComponents(store: FrameStore, page: () => Promise<ComponentsPage>, nodeId: string, newId: NewId): Promise<HomedOutcome> {
  for (let attempt = 0; attempt < HOMING_ATTEMPTS; attempt++) {
    const frame = await store.read(nodeId);
    if (!frame) {
      return NOTHING;
    }
    if (!homeless(frame.doc).size) {
      const homes = homesOf(frame.doc);
      return { moved: [], setIds: [...new Set(Object.values(homes))], homes, head: { version: frame.version, doc: frame.doc } };
    }

    const where = await page();
    if (where.place.canvasId === frame.canvasId) {
      return NOTHING;
    }

    const homes = await placeSets(store, frame, where, newId);
    const homed = homedAt(frame.doc, homes);
    const written = await store.write(nodeId, frame.version, homed, HOMED_SUMMARY);
    if (written.outcome === RevisionOutcome.Written) {
      return { moved: Object.keys(homes), setIds: [...new Set(Object.values(homes))], homes, head: { version: written.head.version, doc: written.head.doc } };
    }
    if (written.outcome === RevisionOutcome.Invalid) {
      return NOTHING;
    }
  }
  return NOTHING;
}
