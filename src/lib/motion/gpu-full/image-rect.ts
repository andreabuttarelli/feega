export type Size = { width: number; height: number };
export type Rect = { x: number; y: number; width: number; height: number };

const FIT_SCALE: Record<string, (a: number, b: number) => number> = { cover: Math.max, contain: Math.min, width: (w) => w };

export function imageRect(box: Size, natural: Size, fit: string, [fx, fy]: [number, number], zoom: number): Rect {
  const scale = (FIT_SCALE[fit] ?? Math.max)(box.width / natural.width, box.height / natural.height);
  const width = natural.width * scale;
  const height = natural.height * scale;
  const px = fx * box.width;
  const py = fy * box.height;
  const x = (box.width - width) * fx;
  const y = (box.height - height) * fy;
  return { x: px + (x - px) * zoom, y: py + (y - py) * zoom, width: width * zoom, height: height * zoom };
}
