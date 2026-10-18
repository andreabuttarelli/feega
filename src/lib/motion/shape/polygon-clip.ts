import ClipperLib from 'clipper-lib';
import type { Pt } from './geometry';

export enum ClipOp {
  Union = 'union',
  Difference = 'difference',
  Intersection = 'intersection',
  Xor = 'xor'
}

type IntPoint = { X: number; Y: number };
type Engine = {
  AddPaths: (paths: IntPoint[][], type: number, closed: boolean) => boolean;
  Execute: (op: number, solution: IntPoint[][], subjectFill: number, clipFill: number) => boolean;
};
type Library = {
  Clipper: new () => Engine;
  ClipType: Record<'ctUnion' | 'ctDifference' | 'ctIntersection' | 'ctXor', number>;
  PolyType: Record<'ptSubject' | 'ptClip', number>;
  PolyFillType: Record<'pftNonZero', number>;
};

const lib = ClipperLib as unknown as Library;

const CLIP_TYPE: Record<ClipOp, keyof Library['ClipType']> = {
  [ClipOp.Union]: 'ctUnion',
  [ClipOp.Difference]: 'ctDifference',
  [ClipOp.Intersection]: 'ctIntersection',
  [ClipOp.Xor]: 'ctXor'
};

const PRECISION = 1_000_000;

const toInt = (polygons: readonly Pt[][]): IntPoint[][] => polygons.map((poly) => poly.map(([x, y]) => ({ X: Math.round(x * PRECISION), Y: Math.round(y * PRECISION) })));

export function clipPolygons(subject: readonly Pt[][], clip: readonly Pt[][], op: ClipOp): Pt[][] {
  const engine = new lib.Clipper();
  engine.AddPaths(toInt(subject), lib.PolyType.ptSubject, true);
  engine.AddPaths(toInt(clip), lib.PolyType.ptClip, true);

  const solution: IntPoint[][] = [];
  engine.Execute(lib.ClipType[CLIP_TYPE[op]], solution, lib.PolyFillType.pftNonZero, lib.PolyFillType.pftNonZero);
  return solution.map((poly) => poly.map((p): Pt => [p.X / PRECISION, p.Y / PRECISION]));
}
