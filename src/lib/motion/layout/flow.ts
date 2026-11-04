import { Direction } from '@feega/motion-core/motion/layout/auto-layout';

export type FlowBox = { left: number; top: number; width: number; height: number };

export type Flow = { direction: Direction; gap: number; order: number[]; box: FlowBox };

const AXES = {
  [Direction.Horizontal]: { start: 'left', length: 'width', crossStart: 'top', crossLength: 'height' },
  [Direction.Vertical]: { start: 'top', length: 'height', crossStart: 'left', crossLength: 'width' }
} as const;

const centre = (b: FlowBox, axis: 'left' | 'top') => b[axis] + (axis === 'left' ? b.width : b.height) / 2;

const spread = (boxes: readonly FlowBox[], axis: 'left' | 'top') => Math.max(...boxes.map((b) => centre(b, axis))) - Math.min(...boxes.map((b) => centre(b, axis)));

export function flowOf(boxes: readonly FlowBox[]): Flow {
  const direction = spread(boxes, 'left') >= spread(boxes, 'top') ? Direction.Horizontal : Direction.Vertical;
  const { start, length, crossStart, crossLength } = AXES[direction];
  const order = boxes.map((_, i) => i).sort((a, b) => boxes[a][start] - boxes[b][start]);
  const sorted = order.map((i) => boxes[i]);
  const spaces = sorted.slice(1).map((b, i) => b[start] - (sorted[i][start] + sorted[i][length]));
  const gap = spaces.length ? Math.max(0, spaces.reduce((a, b) => a + b, 0) / spaces.length) : 0;

  const main = sorted.reduce((sum, b) => sum + b[length], 0) + gap * spaces.length;
  const cross = Math.max(...boxes.map((b) => b[crossLength]));
  const at = { [start]: sorted[0][start], [crossStart]: Math.min(...boxes.map((b) => b[crossStart])) } as { left: number; top: number };
  const size = { [length]: main, [crossLength]: cross } as { width: number; height: number };
  return { direction, gap, order, box: { ...at, ...size } };
}
