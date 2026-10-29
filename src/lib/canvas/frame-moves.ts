import { formatOf, type MotionDoc } from '@feega/motion-core/motion/doc';
import type { CanvasNodeRecord } from '$lib/server/repos/canvas';
import { DropOn } from '$lib/motion/move-element';
import { Left, type FrameSnap, type LandingPlan, type MovePlan, type OnCanvas } from '$lib/motion/move-plan';
import { ADDABLE_LABEL } from './addable';
import { atFirstRevision, motionOf } from './motion-node';
import type { HeldDoc } from './frame-docs';

const ID_LENGTH = 8;
const ID_COUNT = 64;

export type Shown = { made: CanvasNodeRecord | null; gone: string | null; docs: HeldDoc[] };
export type Place = { id: string; canvasId: string; projectId: string };

const NOTHING: Shown = { made: null, gone: null, docs: [] };

export const freshIds = (): string[] => Array.from({ length: ID_COUNT }, () => crypto.randomUUID().slice(0, ID_LENGTH));

export function snapOf(tile: { id: string; type: string; w: number; data: Record<string, unknown> }, doc: MotionDoc): FrameSnap {
  return { nodeId: tile.id, doc, kind: motionOf(tile)?.kind, stage: { width: tile.w, height: (tile.w * doc.height) / doc.width } };
}

function madeOf(landing: OnCanvas, place: Place): CanvasNodeRecord {
  return {
    id: place.id,
    canvasId: place.canvasId,
    projectId: place.projectId,
    type: landing.shape.type,
    displayName: landing.shape.displayName ?? ADDABLE_LABEL.motion,
    position: { ...landing.at, z: 0 },
    size: { width: landing.shape.width, height: landing.shape.height },
    data: { ...atFirstRevision(landing.shape.data), format: formatOf(landing.doc) },
    version: 0
  };
}

function landed(plan: LandingPlan & { ok: true }, place: Place, like: string): Shown {
  const { landing } = plan;
  return landing.on === DropOn.Canvas ? { made: madeOf(landing, place), gone: null, docs: [{ nodeId: place.id, doc: landing.doc, like }] } : { made: null, gone: null, docs: [{ nodeId: landing.nodeId, doc: landing.doc, like }] };
}

const SOURCE_SHOWN: Record<Left, (shown: Shown, sourceId: string, plan: MovePlan & { ok: true }) => Shown> = {
  [Left.Kept]: (shown) => shown,
  [Left.Removed]: (shown, sourceId) => ({ ...shown, gone: sourceId }),
  [Left.Written]: (shown, sourceId, plan) => ({ ...shown, docs: [...shown.docs, { nodeId: sourceId, doc: (plan.source as { doc: MotionDoc }).doc, like: sourceId }] })
};

export function shownMove(plan: MovePlan | null, place: Place, sourceId: string): Shown {
  if (!plan?.ok) {
    return NOTHING;
  }
  return SOURCE_SHOWN[plan.source.left](landed(plan, place, sourceId), sourceId, plan);
}

export function shownLanding(plan: LandingPlan | null, place: Place, like: string): Shown {
  return plan?.ok ? landed(plan, place, like) : NOTHING;
}
