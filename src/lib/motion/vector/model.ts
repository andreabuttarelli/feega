import { z } from 'zod';

export type Vector = { x: number; y: number };

export enum Mirroring {
  None = 'none',
  Angle = 'angle',
  AngleAndLength = 'angle-and-length'
}

export enum Winding {
  NonZero = 'nonzero',
  EvenOdd = 'evenodd'
}

export type VectorVertex = { x: number; y: number; mirroring?: Mirroring };

export type VectorSegment = { start: number; end: number; tangentStart: Vector; tangentEnd: Vector };

export type VectorRegion = { winding: Winding; loops: number[][] };

export type VectorNetwork = { vertices: VectorVertex[]; segments: VectorSegment[]; regions: VectorRegion[] };

export const MAX_VERTICES = 2000;

const vector = z.object({ x: z.number(), y: z.number() });

export const networkSchema = z
  .object({
    vertices: z.array(z.object({ x: z.number(), y: z.number(), mirroring: z.enum(Mirroring).optional() })).max(MAX_VERTICES),
    segments: z.array(z.object({ start: z.number().int().min(0), end: z.number().int().min(0), tangentStart: vector, tangentEnd: vector })).max(MAX_VERTICES * 2),
    regions: z.array(z.object({ winding: z.enum(Winding).default(Winding.NonZero), loops: z.array(z.array(z.number().int().min(0))) })).default([])
  })
  .superRefine((n, ctx) => {
    const bad = n.segments.findIndex((s) => s.start >= n.vertices.length || s.end >= n.vertices.length);
    if (bad >= 0) {
      ctx.addIssue({ code: 'custom', message: `segment ${bad} names a vertex that does not exist` });
    }
    const loose = n.regions.some((r) => r.loops.some((loop) => loop.some((i) => i >= n.segments.length)));
    if (loose) {
      ctx.addIssue({ code: 'custom', message: 'a region loop names a segment that does not exist' });
    }
  });

export const ZERO: Vector = { x: 0, y: 0 };

export const EMPTY_NETWORK: VectorNetwork = { vertices: [], segments: [], regions: [] };
