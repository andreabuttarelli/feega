import { ItemKind, PaintKind, type Item, type Paint } from '@feega/motion-core/motion/gpu-full/display-list';

type Point = [number, number];

const down = (contours: number[][], dy: number): number[][] => contours.map((k) => k.map((v, i) => (i % 2 === 1 ? v + dy : v)));

const lowered = ([x, y]: Point, dy: number): Point => [x, y + dy];

const PAINT_POINTS: Record<PaintKind, (p: never, dy: number) => Paint> = {
  [PaintKind.Solid]: (p: Paint) => p,
  [PaintKind.Linear]: (p: Extract<Paint, { kind: PaintKind.Linear }>, dy) => ({ ...p, from: lowered(p.from, dy), to: lowered(p.to, dy) }),
  [PaintKind.Radial]: (p: Extract<Paint, { kind: PaintKind.Radial }>, dy) => ({ ...p, center: lowered(p.center, dy) }),
  [PaintKind.Sweep]: (p: Extract<Paint, { kind: PaintKind.Sweep }>, dy) => ({ ...p, center: lowered(p.center, dy) }),
  [PaintKind.Diamond]: (p: Extract<Paint, { kind: PaintKind.Diamond }>, dy) => ({ ...p, center: lowered(p.center, dy) })
};

function placed(item: Item, dy: number): Partial<Item> {
  if (item.kind !== ItemKind.Path) {
    const [a, b, c, d, e, f] = item.matrix;
    return { matrix: [a, b, c, d, e, f + dy] };
  }
  return { contours: down(item.contours, dy), paint: PAINT_POINTS[item.paint.kind](item.paint as never, dy), ...(item.within ? { within: { ...item.within, contours: down(item.within.contours, dy) } } : {}) };
}

export function shiftDown(items: readonly Item[], dy: number): Item[] {
  return items.map((item) => {
    const scissor = item.scissor ? { scissor: [item.scissor[0], item.scissor[1] + dy, item.scissor[2], item.scissor[3] + dy] } : {};
    const matte = item.matte ? { matte: { ...item.matte, items: shiftDown(item.matte.items, dy) } } : {};
    return { ...item, ...placed(item, dy), ...scissor, ...matte } as Item;
  });
}
