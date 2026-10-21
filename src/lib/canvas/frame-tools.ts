import type { MotionClip, MotionDoc } from '$lib/motion/doc';
import { DrawTool } from '$lib/motion/draw-tool';
import { canEditPoints } from '$lib/motion/shape/vector-edit';

export enum FrameOverlay {
  Draw = 'draw',
  Guides = 'guides',
  Align = 'align',
  Mask = 'mask',
  Pen = 'pen',
  Vector = 'vector',
  AutoLayout = 'auto-layout',
  TextPath = 'text-path'
}

type Context = { doc: MotionDoc; clip: MotionClip | null; picks: number; tool: DrawTool; pointEdit: string | null; active: boolean };

const MIN_ALIGNED = 2;

const POINT_OVERLAY: Record<string, FrameOverlay> = { path: FrameOverlay.Pen, vector: FrameOverlay.Vector };

const RULES: Record<FrameOverlay, (c: Context) => boolean> = {
  [FrameOverlay.Draw]: (c) => c.tool !== DrawTool.Select,
  [FrameOverlay.Guides]: (c) => Boolean(c.doc.layoutGuides?.length),
  [FrameOverlay.Align]: (c) => c.picks >= MIN_ALIGNED,
  [FrameOverlay.Mask]: (c) => Boolean(c.clip?.mask) && c.active,
  [FrameOverlay.Pen]: (c) => pointsOf(c) === FrameOverlay.Pen,
  [FrameOverlay.Vector]: (c) => pointsOf(c) === FrameOverlay.Vector,
  [FrameOverlay.AutoLayout]: (c) => Boolean(c.clip?.autoLayout) && c.picks === 1 && c.active,
  [FrameOverlay.TextPath]: (c) => Boolean(c.clip?.textPath)
};

function pointsOf(c: Context): FrameOverlay | undefined {
  if (!c.clip || c.clip.id !== c.pointEdit || !c.active || !canEditPoints(c.clip)) {
    return undefined;
  }
  return POINT_OVERLAY[String(c.clip.props.shape)];
}

export const shownOverlays = (c: Context): ReadonlySet<FrameOverlay> => new Set(Object.values(FrameOverlay).filter((overlay) => RULES[overlay](c)));

export const activeAt = (clip: MotionClip, frame: number): boolean => frame >= clip.from && frame < clip.from + clip.durationInFrames;
