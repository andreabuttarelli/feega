export function strokePolygons(points: number[][], width: number, cap: string): number[][][] {
  const JOINT_SIDES = 16;
  const half = width / 2;
  const polys: number[][][] = [];
  const last = points.length - 2;

  for (let i = 0; i <= last; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    const length = Math.hypot(bx - ax, by - ay);
    if (length === 0) {
      continue;
    }
    const ux = (bx - ax) / length;
    const uy = (by - ay) / length;
    const head = cap === 'square' && i === 0 ? half : 0;
    const tail = cap === 'square' && i === last ? half : 0;
    const sx = ax - ux * head;
    const sy = ay - uy * head;
    const ex = bx + ux * tail;
    const ey = by + uy * tail;
    const nx = -uy * half;
    const ny = ux * half;
    polys.push([[sx + nx, sy + ny], [ex + nx, ey + ny], [ex - nx, ey - ny], [sx - nx, sy - ny]]);
  }

  for (let i = 1; i <= last; i++) {
    const [cx, cy] = points[i];
    polys.push(Array.from({ length: JOINT_SIDES }, (_, k) => [cx + Math.cos((k / JOINT_SIDES) * 2 * Math.PI) * half, cy + Math.sin((k / JOINT_SIDES) * 2 * Math.PI) * half]));
  }
  return polys;
}
