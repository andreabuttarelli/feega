export type Polygon = [number, number][];

export enum SampleRule {
  NonZero = 'nonzero',
  EvenOdd = 'evenodd'
}

function windingAt(polygon: Polygon, [px, py]: [number, number]): number {
  let winding = 0;
  for (let i = 0; i < polygon.length; i++) {
    const [x0, y0] = polygon[i];
    const [x1, y1] = polygon[(i + 1) % polygon.length];
    const crossing = (y0 <= py) !== (y1 <= py) && px < x0 + ((py - y0) / (y1 - y0)) * (x1 - x0);
    if (crossing) {
      winding += y1 > y0 ? 1 : -1;
    }
  }
  return winding;
}

export function isFilled(polygons: Polygon[], rule: SampleRule, at: [number, number]): boolean {
  const total = polygons.reduce((sum, polygon) => sum + windingAt(polygon, at), 0);
  return rule === SampleRule.EvenOdd ? total % 2 !== 0 : total !== 0;
}

export function polygonsOf(contours: number[][], place: (p: [number, number]) => [number, number]): Polygon[] {
  return contours.map((flat) => Array.from({ length: flat.length / 2 }, (_, i) => place([flat[2 * i], flat[2 * i + 1]])));
}
