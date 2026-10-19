import ClipperLib from 'clipper-lib';
import type { Pt } from './geometry';

export enum ClipOp {
  Union = 'union',
  Difference = 'difference',
  Intersection = 'intersection',
  Xor = 'xor'
}

export enum Join {
  Miter = 'miter',
  Round = 'round',
  Bevel = 'bevel'
}

export enum Ends {
  Closed = 'closed',
  Butt = 'butt',
  Round = 'round',
  Square = 'square'
}

type IntPoint = { X: number; Y: number };
type Engine = {
  AddPaths: (paths: IntPoint[][], type: number, closed: boolean) => boolean;
  Execute: (op: number, solution: IntPoint[][], subjectFill: number, clipFill: number) => boolean;
};
type Offsetter = {
  AddPaths: (paths: IntPoint[][], join: number, end: number) => void;
  Execute: (solution: IntPoint[][], delta: number) => void;
};
type Library = {
  Clipper: new () => Engine;
  ClipperOffset: new (miterLimit: number, arcTolerance: number) => Offsetter;
  JoinType: Record<'jtSquare' | 'jtRound' | 'jtMiter', number>;
  EndType: Record<'etOpenSquare' | 'etOpenRound' | 'etOpenButt' | 'etClosedPolygon', number>;
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

const JOIN_TYPE: Record<Join, keyof Library['JoinType']> = {
  [Join.Miter]: 'jtMiter',
  [Join.Round]: 'jtRound',
  [Join.Bevel]: 'jtSquare'
};

const END_TYPE: Record<Ends, keyof Library['EndType']> = {
  [Ends.Closed]: 'etClosedPolygon',
  [Ends.Butt]: 'etOpenButt',
  [Ends.Round]: 'etOpenRound',
  [Ends.Square]: 'etOpenSquare'
};

const MITER_LIMIT = 4;
const ARC_TOLERANCE = 0.05;

const toFloat = (solution: IntPoint[][]): Pt[][] => solution.map((poly) => poly.map((p): Pt => [p.X / PRECISION, p.Y / PRECISION]));

const toInt = (polygons: readonly Pt[][]): IntPoint[][] => polygons.map((poly) => poly.map(([x, y]) => ({ X: Math.round(x * PRECISION), Y: Math.round(y * PRECISION) })));

export function clipPolygons(subject: readonly Pt[][], clip: readonly Pt[][], op: ClipOp): Pt[][] {
  const engine = new lib.Clipper();
  engine.AddPaths(toInt(subject), lib.PolyType.ptSubject, true);
  engine.AddPaths(toInt(clip), lib.PolyType.ptClip, true);

  const solution: IntPoint[][] = [];
  engine.Execute(lib.ClipType[CLIP_TYPE[op]], solution, lib.PolyFillType.pftNonZero, lib.PolyFillType.pftNonZero);
  return toFloat(solution);
}

export function offsetPolygons(polygons: readonly Pt[][], delta: number, join: Join, ends: Ends): Pt[][] {
  const engine = new lib.ClipperOffset(MITER_LIMIT, ARC_TOLERANCE * PRECISION);
  engine.AddPaths(toInt(polygons), lib.JoinType[JOIN_TYPE[join]], lib.EndType[END_TYPE[ends]]);

  const solution: IntPoint[][] = [];
  engine.Execute(solution, delta * PRECISION);
  return toFloat(solution);
}
