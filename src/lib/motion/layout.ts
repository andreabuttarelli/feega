import { Ease, ease, lerp } from './design';
import type { Move } from './components';

export type Box = { left: number; top: number; width: number; height: number };

export type Placement = { x: number; y: number; width: number; height: number };

export function boxOf(p: Placement, frame: { width: number; height: number }): Box {
  const width = p.width * frame.width;
  const height = p.height * frame.height;
  return { left: p.x * frame.width - width / 2, top: p.y * frame.height - height / 2, width, height };
}

const DRIFT_PERCENT = 6;
const ZOOM_RANGE = 0.12;

type MoveLook = (t: number) => string;

const MOVES: Record<Move, MoveLook> = {
  none: () => '',
  'drift-up': (t) => `translateY(${lerp(DRIFT_PERCENT, 0, t)}%)`,
  'zoom-in': (t) => `scale(${lerp(1, 1 + ZOOM_RANGE, t)})`,
  'zoom-out': (t) => `scale(${lerp(1 + ZOOM_RANGE, 1, t)})`,
  'pan-left': (t) => `scale(${1 + ZOOM_RANGE}) translateX(${lerp(DRIFT_PERCENT / 2, -DRIFT_PERCENT / 2, t)}%)`,
  'pan-right': (t) => `scale(${1 + ZOOM_RANGE}) translateX(${lerp(-DRIFT_PERCENT / 2, DRIFT_PERCENT / 2, t)}%)`
};

export function moveTransform(move: Move, easing: Ease, frame: number, length: number): string {
  const t = length <= 1 ? 1 : ease(easing, frame / (length - 1));
  return MOVES[move](t);
}

export function angleAt(input: { startAngle: number; endAngle: number; orbitSpeed: number; easing: Ease }, frame: number, length: number, fps: number): number {
  const t = length <= 1 ? 1 : ease(input.easing, frame / (length - 1));
  return lerp(input.startAngle, input.endAngle, t) + (input.orbitSpeed * frame) / fps;
}
