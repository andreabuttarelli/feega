export type ScreenQuad = readonly (readonly [number, number])[];

const PRECISION = 1000;
const DEGREES = 180 / Math.PI;

const neat = (n: number) => Math.round(n * PRECISION) / PRECISION;
const span = (a: readonly [number, number], b: readonly [number, number]) => neat(Math.hypot(b[0] - a[0], b[1] - a[1]));

export function quadBox(q: ScreenQuad) {
  return { left: neat(q[0][0]), top: neat(q[0][1]), width: span(q[0], q[1]), height: span(q[0], q[3]), degrees: neat(Math.atan2(q[1][1] - q[0][1], q[1][0] - q[0][0]) * DEGREES) };
}

export function quadStyle(q: ScreenQuad): string {
  const b = quadBox(q);
  return `left:${b.left}px;top:${b.top}px;width:${b.width}px;height:${b.height}px${b.degrees ? `;transform:rotate(${b.degrees}deg)` : ''}`;
}
