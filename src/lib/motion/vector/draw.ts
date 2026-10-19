import { mirrorHandle, oppositeHandle, Tangent } from './edit';
import { Mirroring, Winding, ZERO, type Vector, type VectorNetwork } from './model';
import { strokeRuns } from './path-sink';

const straight = (start: number, end: number) => ({ start, end, tangentStart: { ...ZERO }, tangentEnd: { ...ZERO } });

export function addVertex(network: VectorNetwork, from: number | null, at: Vector): { network: VectorNetwork; vertex: number } {
  const vertex = network.vertices.length;
  const vertices = [...network.vertices, { x: at.x, y: at.y }];
  const segments = from === null ? network.segments : [...network.segments, straight(from, vertex)];
  return { network: { ...network, vertices, segments }, vertex };
}

export function connect(network: VectorNetwork, a: number, b: number): VectorNetwork {
  const joined = network.segments.some((s) => (s.start === a && s.end === b) || (s.start === b && s.end === a));
  return a === b || joined ? network : { ...network, segments: [...network.segments, straight(a, b)] };
}

export function fillClosed(network: VectorNetwork): VectorNetwork {
  const loops = strokeRuns(network.segments)
    .filter((run) => run.closed)
    .map((run) => run.segments);
  return { ...network, regions: loops.length ? [{ winding: Winding.NonZero, loops }] : [] };
}

export function moveVertex(network: VectorNetwork, vertex: number, by: Vector): VectorNetwork {
  return { ...network, vertices: network.vertices.map((v, i) => (i === vertex ? { ...v, x: v.x + by.x, y: v.y + by.y } : v)) };
}

const vertexOf = (network: VectorNetwork, segment: number, tangent: Tangent) => (tangent === Tangent.Start ? network.segments[segment].start : network.segments[segment].end);

export function setTangent(network: VectorNetwork, segment: number, tangent: Tangent, value: Vector): VectorNetwork {
  const vertex = vertexOf(network, segment, tangent);
  const opposite = oppositeHandle(network, vertex, segment);
  const mode = network.vertices[vertex].mirroring ?? Mirroring.None;
  const mirrored = opposite ? mirrorHandle(value, mode, Math.hypot(network.segments[opposite.segmentIndex][opposite.tangent].x, network.segments[opposite.segmentIndex][opposite.tangent].y)) : null;

  const segments = network.segments.map((s, i) => {
    if (i === segment) {
      return { ...s, [tangent]: { ...value } };
    }
    return opposite && mirrored && i === opposite.segmentIndex ? { ...s, [opposite.tangent]: mirrored } : s;
  });
  return { ...network, segments };
}
