import { Depth, Gesture, drill, type Probe } from '$lib/motion/drill';
import { PART_SEP, partAt, partBoxes } from '$lib/motion/poster-parts';
import type { MeasuredBox } from '$lib/motion/hyperframes/measure';
import type { FramePoint } from './frame-drill';

type Size = { width: number; height: number };
type Boxes = Record<string, MeasuredBox>;

const CLOSED = { depth: Depth.Canvas, clip: null, part: null };

const holds = (b: MeasuredBox, p: FramePoint) => p.x >= b.left && p.x <= b.left + b.width && p.y >= b.top && p.y <= b.top + b.height;

function topAt(clips: Boxes, p: FramePoint): string | null {
  const under = Object.entries(clips)
    .filter(([, b]) => holds(b, p))
    .sort(([, a], [, b]) => a.width * a.height - b.width * b.height);
  return under[0]?.[0] ?? null;
}

function closedProbe(boxes: Boxes, p: FramePoint): Probe {
  const { clips, parts } = partBoxes(boxes);
  const top = topAt(clips, p);
  return {
    top,
    picked: top,
    partOf: (id) => partAt(parts[id] ?? [], [p.x, p.y]),
    firstClip: null,
    firstPart: () => null,
    editable: () => false
  };
}

export function closedHover(boxes: Boxes, p: FramePoint): string | null {
  const { level } = drill(CLOSED, Gesture.Hover, closedProbe(boxes, p));
  if (!level.clip) {
    return null;
  }
  return level.part ? `${level.clip}${PART_SEP}${level.part}` : level.clip;
}

export function containFit(stage: Size, aspect: Size): MeasuredBox {
  const scale = Math.min(stage.width / aspect.width, stage.height / aspect.height);
  const width = aspect.width * scale;
  const height = aspect.height * scale;
  return { left: (stage.width - width) / 2, top: (stage.height - height) / 2, width, height };
}
