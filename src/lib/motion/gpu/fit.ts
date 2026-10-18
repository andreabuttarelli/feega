import type { Size } from './matrix';

export type Rect = [number, number, number, number];

const SCALE: Record<string, (box: Size, natural: Size) => [number, number]> = {
  cover: (b, n) => {
    const s = Math.max(b.width / n.width, b.height / n.height);
    return [s, s];
  },
  contain: (b, n) => {
    const s = Math.min(b.width / n.width, b.height / n.height);
    return [s, s];
  },
  fill: (b, n) => [b.width / n.width, b.height / n.height],
  none: () => [1, 1],
  'scale-down': (b, n) => {
    const s = Math.min(1, b.width / n.width, b.height / n.height);
    return [s, s];
  }
};

export function fitRect(fit: string, box: Size, natural: Size, [fx, fy]: [number, number]): Rect {
  const [sx, sy] = (SCALE[fit] ?? SCALE.cover)(box, natural);
  const width = natural.width * sx;
  const height = natural.height * sy;
  return [(box.width - width) * fx + 0, (box.height - height) * fy + 0, width, height];
}

export function logoRect(box: Size, natural: Size): Rect {
  const height = (box.width * natural.height) / natural.width;
  return [0, (box.height - height) / 2, box.width, height];
}
