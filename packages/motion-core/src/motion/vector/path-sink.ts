import { isLine } from './curve-math';
import type { VectorSegment, VectorVertex } from './model';

export type PathSink = {
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  cubicTo: (x1: number, y1: number, x2: number, y2: number, x: number, y: number) => void;
  close: () => void;
};

export type StrokeRun = { start: number; segments: number[]; closed: boolean };

const PASS_THROUGH = 2;

export function addSegment(sink: PathSink, s: VectorSegment, vertices: readonly VectorVertex[], forward: boolean): void {
  const from = vertices[forward ? s.start : s.end];
  const to = vertices[forward ? s.end : s.start];
  if (isLine(s)) {
    sink.lineTo(to.x, to.y);
    return;
  }
  const out = forward ? s.tangentStart : s.tangentEnd;
  const back = forward ? s.tangentEnd : s.tangentStart;
  sink.cubicTo(from.x + out.x, from.y + out.y, to.x + back.x, to.y + back.y, to.x, to.y);
}

function loopStart(loop: readonly number[], segments: readonly VectorSegment[]): number {
  const first = segments[loop[0]];
  if (loop.length === 1) {
    return first.start;
  }
  const second = segments[loop[1]];
  return first.end === second.start || first.end === second.end ? first.start : first.end;
}

export function addLoop(sink: PathSink, loop: readonly number[], segments: readonly VectorSegment[], vertices: readonly VectorVertex[]): void {
  if (!loop.length) {
    return;
  }
  let current = loopStart(loop, segments);
  sink.moveTo(vertices[current].x, vertices[current].y);
  for (const index of loop) {
    const s = segments[index];
    const forward = s.start === current;
    addSegment(sink, s, vertices, forward);
    current = forward ? s.end : s.start;
  }
  sink.close();
}

export function strokeRuns(segments: readonly VectorSegment[]): StrokeRun[] {
  const incident = new Map<number, number[]>();
  const meet = (vertex: number, index: number) => incident.set(vertex, [...(incident.get(vertex) ?? []), index]);
  segments.forEach((s, i) => {
    meet(s.start, i);
    if (s.end !== s.start) {
      meet(s.end, i);
    }
  });

  const used = new Set<number>();
  const across = (index: number, vertex: number) => (segments[index].start === vertex ? segments[index].end : segments[index].start);
  const extend = (from: number, via: number, add: (index: number) => void): number => {
    let vertex = from;
    let previous = via;
    for (;;) {
      const meeting = incident.get(vertex);
      if (meeting?.length !== PASS_THROUGH) {
        return vertex;
      }
      const next = meeting[0] === previous ? meeting[1] : meeting[0];
      if (used.has(next)) {
        return vertex;
      }
      used.add(next);
      add(next);
      vertex = across(next, vertex);
      previous = next;
    }
  };

  const runs: StrokeRun[] = [];
  segments.forEach((s, first) => {
    if (used.has(first)) {
      return;
    }
    used.add(first);
    const run = [first];
    const end = extend(s.end, first, (i) => run.push(i));
    if (end === s.start) {
      runs.push({ start: s.start, segments: run, closed: true });
      return;
    }
    const start = extend(s.start, first, (i) => run.unshift(i));
    runs.push({ start, segments: run, closed: start === end });
  });
  return runs;
}

export function addStrokeRun(sink: PathSink, run: StrokeRun, segments: readonly VectorSegment[], vertices: readonly VectorVertex[]): void {
  let current = run.start;
  sink.moveTo(vertices[current].x, vertices[current].y);
  for (const index of run.segments) {
    const s = segments[index];
    const forward = s.start === current;
    addSegment(sink, s, vertices, forward);
    current = forward ? s.end : s.start;
  }
  if (run.closed) {
    sink.close();
  }
}
