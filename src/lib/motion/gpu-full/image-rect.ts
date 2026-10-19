export type Size = { width: number; height: number };
export type Rect = { x: number; y: number; width: number; height: number };

const FIT_SCALE: Record<string, (a: number, b: number) => [number, number]> = {
  cover: (a, b) => [Math.max(a, b), Math.max(a, b)],
  contain: (a, b) => [Math.min(a, b), Math.min(a, b)],
  width: (a) => [a, a],
  fill: (a, b) => [a, b]
};

export function imageRect(box: Size, natural: Size, fit: string, [fx, fy]: [number, number], zoom: number): Rect {
  const [sx, sy] = (FIT_SCALE[fit] ?? FIT_SCALE.cover)(box.width / natural.width, box.height / natural.height);
  const width = natural.width * sx;
  const height = natural.height * sy;
  const px = fx * box.width;
  const py = fy * box.height;
  const x = (box.width - width) * fx;
  const y = (box.height - height) * fy;
  return { x: px + (x - px) * zoom, y: py + (y - py) * zoom, width: width * zoom, height: height * zoom };
}
