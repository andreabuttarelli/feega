import { PaintKind } from './paint-of';
import { frameAt, type Drawn, type Point, type Quad, type Scene } from './scene';

export type FrameRect = { left: number; top: number; width: number; height: number };

const SIDES = [0, 1, 2, 3] as const;

function inside(quad: Quad, [x, y]: Point): boolean {
  const turns = SIDES.map((i) => {
    const [ax, ay] = quad[i];
    const [bx, by] = quad[(i + 1) % SIDES.length];
    return Math.sign((bx - ax) * (y - ay) - (by - ay) * (x - ax));
  });
  return !turns.some((s) => s > 0) || !turns.some((s) => s < 0);
}

const pickable = (d: Drawn) => d.paint.kind !== PaintKind.Html && d.opacity > 0;

const holds = (d: Drawn, p: Point) => inside(d.quad, p) && d.clips.every((c) => inside(c, p));

const topAt = (scene: Scene, point: Point, time: number) => frameAt(scene, time).filter(pickable).findLast((d) => holds(d, point));

export function pickAt(scene: Scene, point: Point, time: number): string | null {
  return topAt(scene, point, time)?.clip ?? null;
}

export function pickOwnersAt(scene: Scene, point: Point, time: number): string[] {
  return topAt(scene, point, time)?.layer.owners ?? [];
}

const drawnOf = (scene: Scene, clip: string, time: number) => frameAt(scene, time).filter((d) => d.layer.covers.includes(clip) || d.layer.owners.includes(clip));

function spanOf(corners: Point[]): FrameRect {
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
}

export function rectOf(scene: Scene, clip: string, time: number): FrameRect | null {
  const corners = drawnOf(scene, clip, time).flatMap((d) => d.quad);
  return corners.length ? spanOf(corners) : null;
}

const turned = ([x, y]: Point, cos: number, sin: number): Point => [x * cos - y * sin, x * sin + y * cos];

export function quadOf(scene: Scene, clip: string, time: number): Quad | null {
  const drawn = drawnOf(scene, clip, time);
  if (!drawn.length) {
    return null;
  }
  const own = drawn.find((d) => d.clip === clip)?.quad;
  const angle = own ? Math.atan2(own[1][1] - own[0][1], own[1][0] - own[0][0]) : 0;
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  const r = spanOf(drawn.flatMap((d) => d.quad).map((p) => turned(p, cos, -sin)));
  const corners: Point[] = [
    [r.left, r.top],
    [r.left + r.width, r.top],
    [r.left + r.width, r.top + r.height],
    [r.left, r.top + r.height]
  ];
  return corners.map((p) => (angle ? turned(p, cos, sin) : p)) as Quad;
}
