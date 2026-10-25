import { segmentsOf, type Contour, type Outline, type Pt, type Vertex } from '../shape/geometry';
import { Winding, type Vector, type VectorNetwork, type VectorSegment } from './model';
import { addLoop, addStrokeRun, strokeRuns, type PathSink } from './path-sink';

const same = (a: Pt, b: Pt) => a[0] === b[0] && a[1] === b[1];

function outlineSink(): PathSink & { outline: Outline } {
  const outline: Outline = [];
  const current = () => outline.at(-1)!;
  const last = () => current().vertices.at(-1)!;

  return {
    outline,
    moveTo: (x, y) => void outline.push({ vertices: [{ p: [x, y], in: [x, y], out: [x, y] }], closed: false }),
    lineTo: (x, y) => void current().vertices.push({ p: [x, y], in: [x, y], out: [x, y] }),
    cubicTo: (x1, y1, x2, y2, x, y) => {
      last().out = [x1, y1];
      current().vertices.push({ p: [x, y], in: [x2, y2], out: [x, y] });
    },
    close: () => {
      const contour = current();
      contour.closed = true;
      const [first] = contour.vertices;
      const end = contour.vertices.at(-1)!;
      if (contour.vertices.length > 1 && same(first.p, end.p)) {
        first.in = end.in;
        contour.vertices.pop();
      }
    }
  };
}

export function networkFill(network: VectorNetwork): Outline {
  const sink = outlineSink();
  for (const region of network.regions) {
    for (const loop of region.loops) {
      addLoop(sink, loop, network.segments, network.vertices);
    }
  }
  return sink.outline;
}

export function networkStroke(network: VectorNetwork): Outline {
  const sink = outlineSink();
  for (const run of strokeRuns(network.segments)) {
    addStrokeRun(sink, run, network.segments, network.vertices);
  }
  return sink.outline;
}

const offset = (to: Pt, from: Pt): Vector => ({ x: to[0] - from[0], y: to[1] - from[1] });

function contourNetwork(contour: Contour, base: { vertices: number; segments: number }): { vertices: Vertex[]; segments: VectorSegment[]; loop: number[] } {
  const index = new Map(contour.vertices.map((v, i) => [v, base.vertices + i]));
  const segments = segmentsOf(contour).map(([a, b]) => ({ start: index.get(a)!, end: index.get(b)!, tangentStart: offset(a.out, a.p), tangentEnd: offset(b.in, b.p) }));
  return { vertices: contour.vertices, segments, loop: segments.map((_, i) => base.segments + i) };
}

export function outlineToNetwork(outline: Outline, winding: Winding = Winding.NonZero): VectorNetwork {
  const network: VectorNetwork = { vertices: [], segments: [], regions: [] };
  const loops: number[][] = [];
  for (const contour of outline.filter((c) => c.vertices.length)) {
    const part = contourNetwork(contour, { vertices: network.vertices.length, segments: network.segments.length });
    network.vertices.push(...part.vertices.map((v) => ({ x: v.p[0], y: v.p[1] })));
    network.segments.push(...part.segments);
    if (contour.closed) {
      loops.push(part.loop);
    }
  }
  network.regions = loops.length ? [{ winding, loops }] : [];
  return network;
}
