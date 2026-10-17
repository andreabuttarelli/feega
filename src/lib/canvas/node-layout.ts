import { z } from 'zod';

export const nodeLayoutSchema = z.object({
  rotation: z.number().finite().min(-180).max(180).optional(),
  groupId: z.string().min(1).nullable().optional()
});

export const LAYOUT_KEYS = ['rotation', 'groupId'] as const;

export type Layout = { rotation: number; groupId: string | null };

export function layoutOf(data: Record<string, unknown>): Layout {
  const parsed = nodeLayoutSchema.safeParse({ rotation: data.rotation, groupId: data.groupId });
  return { rotation: parsed.success ? (parsed.data.rotation ?? 0) : 0, groupId: parsed.success ? (parsed.data.groupId ?? null) : null };
}

export type Placed = { id: string; x: number; y: number; w: number; h: number; rotation: number };

const FULL_TURN = 360;
const HALF_TURN = 180;
const RADIANS = Math.PI / HALF_TURN;

export function wrapAngle(deg: number): number {
  const turned = (((deg + HALF_TURN) % FULL_TURN) + FULL_TURN) % FULL_TURN - HALF_TURN;
  return turned === -HALF_TURN && deg > 0 ? HALF_TURN : turned;
}

export function rotateGroup(group: Placed, members: readonly Placed[], deg: number): Placed[] {
  const cx = group.x + group.w / 2;
  const cy = group.y + group.h / 2;
  const cos = Math.cos(deg * RADIANS);
  const sin = Math.sin(deg * RADIANS);
  const turn = (n: Placed): Placed => {
    const mx = n.x + n.w / 2 - cx;
    const my = n.y + n.h / 2 - cy;
    const nx = cx + mx * cos - my * sin;
    const ny = cy + mx * sin + my * cos;
    return { ...n, x: nx - n.w / 2, y: ny - n.h / 2, rotation: wrapAngle(n.rotation + deg) };
  };
  return [{ ...group, rotation: wrapAngle(group.rotation + deg) }, ...members.map(turn)];
}

export function translateGroup(members: readonly Pick<Placed, 'id' | 'x' | 'y'>[], delta: { dx: number; dy: number }): { id: string; x: number; y: number }[] {
  return members.map((m) => ({ id: m.id, x: m.x + delta.dx, y: m.y + delta.dy }));
}

type Point = { x: number; y: number };

export function dragAngle(centre: Point, from: Point, to: Point, snap = 0): number {
  const swept = (Math.atan2(to.y - centre.y, to.x - centre.x) - Math.atan2(from.y - centre.y, from.x - centre.x)) / RADIANS;
  const wrapped = wrapAngle(swept);
  return snap ? Math.round(wrapped / snap) * snap : wrapped;
}

export function scaleGroup(group: Placed, members: readonly Placed[], to: { w: number; h: number }): Placed[] {
  const sx = to.w / group.w;
  const sy = to.h / group.h;
  const scale = (n: Placed): Placed => ({ ...n, x: group.x + (n.x - group.x) * sx, y: group.y + (n.y - group.y) * sy, w: n.w * sx, h: n.h * sy });
  return [{ ...group, w: to.w, h: to.h }, ...members.map(scale)];
}

export function followGroup(origins: ReadonlyMap<string, { x: number; y: number }>, groupId: string, at: { x: number; y: number }, members: readonly string[]): { id: string; x: number; y: number }[] {
  const start = origins.get(groupId);
  if (!start) {
    return [];
  }
  const delta = { dx: at.x - start.x, dy: at.y - start.y };
  return translateGroup(members.flatMap((id) => (origins.has(id) ? [{ id, ...origins.get(id)! }] : [])), delta);
}

export type Turn = { id: string; degrees: number };

export const undoTurn = (turn: Turn): Turn => ({ id: turn.id, degrees: -turn.degrees || 0 });
