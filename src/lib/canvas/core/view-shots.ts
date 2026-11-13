import type { Box } from './canvas-scene';

export type ViewShot = { id: string; dx: number; w: number; h: number };

type Placed = { id: string; box: Box };

export const shotsOf = (base: Box, views: readonly { frame: Placed }[]): ViewShot[] => views.map(({ frame }) => ({ id: frame.id, dx: (frame.box.x - base.x) / base.w, w: frame.box.w / base.w, h: frame.box.h / base.w }));

export const placedShots = <F extends Placed & { kind: string; revision: number }>(base: F, shots: readonly ViewShot[]): { id: string; kind: F['kind']; revision: number; box: Box }[] =>
  shots.map((s) => ({ id: s.id, kind: base.kind, revision: base.revision, box: { x: base.box.x + s.dx * base.box.w, y: base.box.y, w: s.w * base.box.w, h: s.h * base.box.w } }));
