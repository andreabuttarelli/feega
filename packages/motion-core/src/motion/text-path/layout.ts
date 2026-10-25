export type Curve = { points: [number, number][]; closed: boolean };

export type Placement = { first: number; last: number; align: number; reverse: boolean; perpendicular: boolean; force: boolean };

export type Placed = [x: number, y: number, angle: number];

export function placeGlyphs(curve: Curve, advances: readonly number[], o: Placement): Placed[] {
  const DIGITS = 1000;
  const round = (n: number) => Math.round(n * DIGITS) / DIGITS || 0;
  const ordered = o.reverse ? curve.points.slice().reverse() : curve.points.slice();
  const ring = curve.closed && ordered.length > 1 ? [...ordered, ordered[0]] : ordered;
  const pts = ring.filter((p, i) => i === 0 || p[0] !== ring[i - 1][0] || p[1] !== ring[i - 1][1]);
  if (pts.length < 2) {
    const only = pts[0] ?? [0, 0];
    return advances.map(() => [round(only[0]), round(only[1]), 0]);
  }

  const at = [0];
  for (let i = 1; i < pts.length; i++) {
    at.push(at[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const total = at[at.length - 1];
  const from = (total * o.first) / 100;
  const to = total - (total * o.last) / 100;
  const width = advances.reduce((sum, a) => sum + a, 0);
  const gap = o.force && advances.length > 1 ? (to - from - width) / (advances.length - 1) : 0;
  const start = o.force ? from : from + o.align * (to - from - width);

  const sample = (distance: number): Placed => {
    const d = curve.closed ? ((distance % total) + total) % total : distance;
    let i = 1;
    while (i < pts.length - 1 && at[i] < d) {
      i++;
    }
    const a = pts[i - 1];
    const b = pts[i];
    const t = (d - at[i - 1]) / (at[i] - at[i - 1]);
    const angle = o.perpendicular ? (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI : 0;
    return [round(a[0] + (b[0] - a[0]) * t), round(a[1] + (b[1] - a[1]) * t), round(angle)];
  };

  let walked = start;
  return advances.map((advance) => {
    const placed = sample(walked + advance / 2);
    walked += advance + gap;
    return placed;
  });
}
