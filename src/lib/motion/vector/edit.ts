import { evalCubic, isLine, segmentCubic, splitCubicAt } from './curve-math';
import { Mirroring, ZERO, type Vector, type VectorNetwork, type VectorSegment, type VectorVertex } from './model';
import { reindexRegionLoops, remapRegions } from './regions';

export enum Tangent {
  Start = 'tangentStart',
  End = 'tangentEnd'
}

export type Handle = { segmentIndex: number; tangent: Tangent; neighbor: number };

const NEAR_ZERO = 1e-6;
const DETERMINANT_EPSILON = 1e-9;
const MERGE_TOLERANCE = 0.05;

const relative = (to: Vector, from: Vector): Vector => ({ x: to.x - from.x, y: to.y - from.y });

export function splitSegmentAt(network: VectorNetwork, segmentIndex: number, t: number): { network: VectorNetwork; vertex: number } {
  const s = network.segments[segmentIndex];
  const a = network.vertices[s.start];
  const b = network.vertices[s.end];
  const vertex = network.vertices.length;

  const halves = isLine(s) ? lineHalves(a, b, s, t, vertex) : curveHalves(network, segmentIndex, t, vertex);
  const segments = [...network.segments];
  segments[segmentIndex] = halves.first;
  segments.push(halves.second);

  const regions = reindexRegionLoops(network.regions, segmentIndex, [segmentIndex, segments.length - 1], network.segments);
  return { network: { vertices: [...network.vertices, halves.at], segments, regions }, vertex };
}

function lineHalves(a: Vector, b: Vector, s: VectorSegment, t: number, vertex: number) {
  return {
    at: { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y), mirroring: Mirroring.None },
    first: { start: s.start, end: vertex, tangentStart: { ...ZERO }, tangentEnd: { ...ZERO } },
    second: { start: vertex, end: s.end, tangentStart: { ...ZERO }, tangentEnd: { ...ZERO } }
  };
}

function curveHalves(network: VectorNetwork, segmentIndex: number, t: number, vertex: number) {
  const s = network.segments[segmentIndex];
  const { left, right } = splitCubicAt(segmentCubic(network, segmentIndex), t);
  return {
    at: { x: left.p3.x, y: left.p3.y, mirroring: Mirroring.AngleAndLength },
    first: { start: s.start, end: vertex, tangentStart: relative(left.cp1, left.p0), tangentEnd: relative(left.cp2, left.p3) },
    second: { start: vertex, end: s.end, tangentStart: relative(right.cp1, right.p0), tangentEnd: relative(right.cp2, right.p3) }
  };
}

const touching = (segments: readonly VectorSegment[], vertex: number) => segments.flatMap((s, i) => (s.start === vertex || s.end === vertex ? [i] : []));

const shift = (removed: number) => (index: number) => (index > removed ? index - 1 : index);

function mergedTangents(a: Vector, r: Vector, b: Vector, dirA: Vector, dirB: Vector) {
  const dA = Math.hypot(r.x - a.x, r.y - a.y);
  const dB = Math.hypot(b.x - r.x, b.y - r.y);
  const total = dA + dB;
  const t = total > NEAR_ZERO ? dA / total : 0.5;
  const mt = 1 - t;

  const scaled = { tangentStart: { x: dirA.x / (mt > NEAR_ZERO ? mt : 1), y: dirA.y / (mt > NEAR_ZERO ? mt : 1) }, tangentEnd: { x: dirB.x / (t > NEAR_ZERO ? t : 1), y: dirB.y / (t > NEAR_ZERO ? t : 1) } };
  const through = evalCubic({ p0: a, cp1: { x: a.x + scaled.tangentStart.x, y: a.y + scaled.tangentStart.y }, cp2: { x: b.x + scaled.tangentEnd.x, y: b.y + scaled.tangentEnd.y }, p3: b }, t);
  if (Math.hypot(through.x - r.x, through.y - r.y) < total * MERGE_TOLERANCE) {
    return scaled;
  }
  return solvedTangents(a, r, b, dirA, dirB, mt, t);
}

function solvedTangents(a: Vector, r: Vector, b: Vector, dirA: Vector, dirB: Vector, mt: number, t: number) {
  const b1 = 3 * mt * mt * t;
  const b2 = 3 * mt * t * t;
  const rhs = { x: r.x - (mt ** 3 + b1) * a.x - (t ** 3 + b2) * b.x, y: r.y - (mt ** 3 + b1) * a.y - (t ** 3 + b2) * b.y };
  const det = b1 * dirA.x * b2 * dirB.y - b1 * dirA.y * b2 * dirB.x;
  if (Math.abs(det) > DETERMINANT_EPSILON) {
    const alpha = (rhs.x * b2 * dirB.y - rhs.y * b2 * dirB.x) / det;
    const beta = (b1 * dirA.x * rhs.y - b1 * dirA.y * rhs.x) / det;
    return { tangentStart: { x: alpha * dirA.x, y: alpha * dirA.y }, tangentEnd: { x: beta * dirB.x, y: beta * dirB.y } };
  }

  const toA = relative(r, a);
  const toB = relative(r, b);
  const inner = { x: b1 * toA.x + b2 * toB.x, y: b1 * toA.y + b2 * toB.y };
  const wide = Math.abs(inner.x) > Math.abs(inner.y);
  const k = wide ? (inner.x ? rhs.x / inner.x : 1) : inner.y ? rhs.y / inner.y : 1;
  return { tangentStart: { x: k * toA.x, y: k * toA.y }, tangentEnd: { x: k * toB.x, y: k * toB.y } };
}

function mergedAcross(vertices: readonly VectorVertex[], segments: readonly VectorSegment[], pair: number[], vertex: number): VectorSegment {
  const [sa, sb] = pair.map((i) => segments[i]);
  const other = (s: VectorSegment) => (s.start === vertex ? s.end : s.start);
  const inward = (s: VectorSegment) => (s.start === vertex ? s.tangentEnd : s.tangentStart);
  const tangents = mergedTangents(vertices[other(sa)], vertices[vertex], vertices[other(sb)], inward(sa), inward(sb));
  const re = shift(vertex);
  return { start: re(other(sa)), end: re(other(sb)), ...tangents };
}

function withoutSegments(network: VectorNetwork, vertex: number, removed: Set<number>, merged: VectorSegment | null): VectorNetwork {
  const re = shift(vertex);
  const segments: VectorSegment[] = [];
  const indexMap = new Map<number, number | null>();
  let mergedAt = -1;

  network.segments.forEach((s, i) => {
    if (!removed.has(i)) {
      indexMap.set(i, segments.length);
      segments.push({ start: re(s.start), end: re(s.end), tangentStart: { ...s.tangentStart }, tangentEnd: { ...s.tangentEnd } });
      return;
    }
    if (!merged) {
      indexMap.set(i, null);
      return;
    }
    if (mergedAt < 0) {
      mergedAt = segments.length;
      segments.push(merged);
    }
    indexMap.set(i, mergedAt);
  });

  return { vertices: network.vertices.filter((_, i) => i !== vertex), segments, regions: remapRegions(network.regions, indexMap) };
}

const PASS_THROUGH = 2;

export function removeVertex(network: VectorNetwork, vertex: number): VectorNetwork | null {
  if (network.vertices.length <= 1) {
    return null;
  }
  const connected = touching(network.segments, vertex);
  const merged = connected.length === PASS_THROUGH ? mergedAcross(network.vertices, network.segments, connected, vertex) : null;
  return withoutSegments(network, vertex, new Set(connected), merged);
}

export function deleteVertex(network: VectorNetwork, vertex: number): VectorNetwork | null {
  if (network.vertices.length <= 1) {
    return null;
  }
  const out = withoutSegments(network, vertex, new Set(touching(network.segments, vertex)), null);
  return { ...out, regions: [] };
}

export function breakAtVertex(network: VectorNetwork, vertex: number): VectorNetwork {
  const incoming = network.segments.flatMap((s, i) => (s.end === vertex ? [i] : []));
  const outgoing = network.segments.flatMap((s, i) => (s.start === vertex && s.end !== vertex ? [i] : []));
  if (!incoming.length || !outgoing.length) {
    return network;
  }

  const copy = network.vertices.length;
  const segments = network.segments.map((s, i) => {
    if (outgoing.includes(i)) {
      return { ...s, start: copy, tangentStart: { ...ZERO } };
    }
    return incoming.includes(i) ? { ...s, tangentEnd: { ...ZERO } } : { ...s };
  });
  return { vertices: [...network.vertices, { ...network.vertices[vertex] }], segments, regions: [] };
}

export function mirrorHandle(handle: Vector, mode: Mirroring, oppositeLength?: number): Vector | null {
  if (mode === Mirroring.None) {
    return null;
  }
  if (mode === Mirroring.AngleAndLength) {
    return { x: 0 - handle.x, y: 0 - handle.y };
  }
  const length = Math.hypot(handle.x, handle.y);
  if (length < DETERMINANT_EPSILON) {
    return { ...ZERO };
  }
  const k = (oppositeLength ?? length) / length;
  return { x: -handle.x * k, y: -handle.y * k };
}

export function handlesAt(network: VectorNetwork, vertex: number): Handle[] {
  return network.segments.flatMap((s, i) => [
    ...(s.start === vertex ? [{ segmentIndex: i, tangent: Tangent.Start, neighbor: s.end }] : []),
    ...(s.end === vertex ? [{ segmentIndex: i, tangent: Tangent.End, neighbor: s.start }] : [])
  ]);
}

export function oppositeHandle(network: VectorNetwork, vertex: number, segmentIndex: number): Handle | null {
  return handlesAt(network, vertex).find((h) => h.segmentIndex !== segmentIndex) ?? null;
}
