import { describe, expect, it } from 'vitest';
import { addStrokeRun, strokeRuns, type PathSink } from './path-sink';
import type { VectorSegment, VectorVertex } from './model';

const zero = { x: 0, y: 0 };
const line = (start: number, end: number): VectorSegment => ({ start, end, tangentStart: zero, tangentEnd: zero });

function recorder(): PathSink & { commands: string[] } {
  const commands: string[] = [];
  return {
    commands,
    moveTo: (x, y) => void commands.push(`M${x},${y}`),
    lineTo: (x, y) => void commands.push(`L${x},${y}`),
    cubicTo: (_a, _b, _c, _d, x, y) => void commands.push(`C${x},${y}`),
    close: () => void commands.push('Z')
  };
}

function draw(segments: VectorSegment[], vertices: VectorVertex[]) {
  return strokeRuns(segments).map((run) => {
    const sink = recorder();
    addStrokeRun(sink, run, segments, vertices);
    return sink.commands.join(' ');
  });
}

describe('stroke runs', () => {
  it('an open polyline strokes as one contour, so its corners join', () => {
    expect(draw([line(0, 1), line(1, 2)], [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])).toEqual(['M0,0 L10,0 L10,10']);
  });

  it('segments stored out of order and backwards still chain', () => {
    const runs = draw([line(2, 1), line(0, 1), line(2, 3)], [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]);
    expect(runs).toHaveLength(1);
    expect(['M0,0 L10,0 L10,10 L0,10', 'M0,10 L10,10 L10,0 L0,0']).toContain(runs[0]);
  });

  it('a loop closes', () => {
    expect(draw([line(0, 1), line(1, 2), line(2, 0)], [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])).toEqual(['M0,0 L10,0 L10,10 L0,0 Z']);
  });

  it('a junction of three segments ends the runs that meet there', () => {
    const runs = strokeRuns([line(0, 1), line(0, 2), line(0, 3)]);
    expect(runs.map((r) => r.segments)).toEqual([[0], [1], [2]]);
    expect(runs.every((r) => !r.closed)).toBe(true);
  });

  it('a loop through a junction closes whichever of its segments is stored first', () => {
    const square = [line(0, 1), line(1, 2), line(2, 3), line(3, 0)];
    for (const segments of [[...square, line(0, 4)], [square[1], square[2], square[3], square[0], line(0, 4)]]) {
      expect(strokeRuns(segments).find((r) => r.segments.length === 4)?.closed).toBe(true);
    }
  });

  it('a curve drawn backwards swaps its handles', () => {
    const curve = { start: 2, end: 1, tangentStart: { x: 0, y: 5 }, tangentEnd: { x: 0, y: -5 } };
    const cubic: number[][] = [];
    const sink = { ...recorder(), cubicTo: (...args: number[]) => void cubic.push(args) };
    for (const run of strokeRuns([line(0, 1), curve])) {
      addStrokeRun(sink, run, [line(0, 1), curve], [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }]);
    }
    expect(cubic).toEqual([[10, -5, 20, 5, 20, 0]]);
  });
});
