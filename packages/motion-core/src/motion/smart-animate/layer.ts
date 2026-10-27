import { defaultProps, type ComponentId } from '../components';
import type { MotionClip, MotionDoc } from '../doc';
import { clipsOf } from '../doc';
import { FillType } from '../fill/model';

export type Layer = {
  key: string;
  clipId: string;
  component: ComponentId;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  fill: string;
  radius: number;
};

const ELLIPSE = 'ellipse';
const FULLY_ROUND = 0.5;

const num = (value: unknown, fallback: number): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

function fillOf(props: Record<string, unknown>): string {
  const stack = Array.isArray(props.fills) ? (props.fills as { type?: string; color?: string; visible?: boolean }[]) : [];
  const solid = stack.find((f) => f.type === FillType.Solid && f.visible !== false && typeof f.color === 'string');
  if (solid) {
    return solid.color!;
  }
  return typeof props.fill === 'string' ? props.fill : 'transparent';
}

export function layerOf(clip: MotionClip, key: string): Layer {
  const props = { ...defaultProps(clip.component), ...clip.props };

  return {
    key,
    clipId: clip.id,
    component: clip.component,
    x: num(props.x, 0.5),
    y: num(props.y, 0.5),
    width: num(props.width, 0.8),
    height: num(props.height, 0.5),
    rotation: num(props.rotation, 0),
    opacity: num(props.opacity, 1),
    fill: fillOf(props),
    radius: props.shape === ELLIPSE ? FULLY_ROUND : num(props.roundness, 0)
  };
}

function uniqueNames(clips: MotionClip[]): Set<string> {
  const counts = new Map<string, number>();
  for (const clip of clips) {
    if (clip.name) {
      counts.set(clip.name, (counts.get(clip.name) ?? 0) + 1);
    }
  }
  return new Set([...counts].filter(([, n]) => n === 1).map(([name]) => name));
}

export function layersOf(doc: MotionDoc): Layer[] {
  const clips = clipsOf(doc);
  const unique = uniqueNames(clips);

  return clips.map((clip) => layerOf(clip, clip.name && unique.has(clip.name) ? clip.name : clip.id));
}
