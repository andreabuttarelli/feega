import type { Rgba } from './rgba';

export enum PaintKind {
  Solid = 'solid',
  Linear = 'linear',
  Radial = 'radial'
}

export enum FillRule {
  NonZero = 'nonzero',
  EvenOdd = 'evenodd',
  Union = 'union'
}

export const MAX_STOPS = 8;

export type Stop ={ at: number; color: Rgba };

export type Paint =
  | { kind: PaintKind.Solid; color: Rgba }
  | { kind: PaintKind.Linear; from: [number, number]; to: [number, number]; stops: Stop[] }
  | { kind: PaintKind.Radial; center: [number, number]; radius: number; stops: Stop[] };
