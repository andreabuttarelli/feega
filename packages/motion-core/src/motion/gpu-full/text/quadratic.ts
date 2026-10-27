import { Op, type Command } from './face';

export type TruePoint = { x: number; y: number; onCurve: boolean; endContour: boolean };

const mid = (a: TruePoint, b: TruePoint): TruePoint => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, onCurve: true, endContour: false });

function contourPath(points: TruePoint[]): Command[] {
  const firstOn = points.findIndex((p) => p.onCurve);
  const start = firstOn >= 0 ? points[firstOn] : mid(points[points.length - 1], points[0]);
  const from = firstOn >= 0 ? firstOn + 1 : 0;
  const rest = [...points.slice(from), ...points.slice(0, firstOn >= 0 ? firstOn : 0)];
  const out: Command[] = [{ op: Op.Move, at: [start.x, start.y] }];
  let control: TruePoint | null = null;
  for (const p of [...rest, start]) {
    if (!p.onCurve) {
      if (control) {
        const m = mid(control, p);
        out.push({ op: Op.Quad, at: [control.x, control.y, m.x, m.y] });
      }
      control = p;
      continue;
    }
    out.push(control ? { op: Op.Quad, at: [control.x, control.y, p.x, p.y] } : { op: Op.Line, at: [p.x, p.y] });
    control = null;
  }
  if (out.at(-1)?.op === Op.Line) {
    out.pop();
  }
  return [...out, { op: Op.Close, at: [] }];
}

export function quadraticPath(points: TruePoint[]): Command[] {
  const contours: TruePoint[][] = [[]];
  for (const p of points) {
    contours[contours.length - 1].push(p);
    if (p.endContour) {
      contours.push([]);
    }
  }
  return contours.filter((c) => c.length).flatMap(contourPath);
}
