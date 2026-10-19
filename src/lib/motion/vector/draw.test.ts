import { describe, expect, it } from 'vitest';
import { addVertex, connect, fillClosed, moveVertex, setTangent } from './draw';
import { Tangent } from './edit';
import { Mirroring, Winding, type VectorNetwork } from './model';

const zero = { x: 0, y: 0 };
const line = (start: number, end: number) => ({ start, end, tangentStart: zero, tangentEnd: zero });

const vee = (): VectorNetwork => ({ vertices: [{ x: 0, y: 0 }, { x: 0.5, y: 1 }, { x: 1, y: 0 }], segments: [line(0, 1), line(1, 2)], regions: [] });

describe('drawing a vector network with the pen', () => {
  it('a click with nothing selected starts a lone vertex', () => {
    const { network, vertex } = addVertex({ vertices: [], segments: [], regions: [] }, null, { x: 0.2, y: 0.3 });
    expect(network.vertices[vertex]).toEqual({ x: 0.2, y: 0.3 });
    expect(network.segments).toEqual([]);
  });

  it('a click after a vertex draws a segment from it, so a middle vertex can branch', () => {
    const { network } = addVertex(vee(), 1, { x: 0.5, y: 0 });
    expect(network.segments.at(-1)).toMatchObject({ start: 1, end: 3 });
    expect(network.segments.filter((s) => s.start === 1 || s.end === 1)).toHaveLength(3);
  });

  it('joining two vertices adds the segment once', () => {
    const joined = connect(vee(), 2, 0);
    expect(joined.segments).toHaveLength(3);
    expect(connect(joined, 0, 2).segments).toHaveLength(3);
  });

  it('a closed run can be filled', () => {
    const filled = fillClosed(connect(vee(), 2, 0));
    expect(filled.regions).toEqual([{ winding: Winding.NonZero, loops: [[0, 1, 2]] }]);
  });
});

describe('editing a vector network', () => {
  it('moves a vertex, its curves following', () => {
    expect(moveVertex(vee(), 1, { x: 0.1, y: -0.2 }).vertices[1]).toEqual({ x: 0.6, y: 0.8 });
  });

  it('drags a handle and mirrors the one across a smooth vertex', () => {
    const smooth: VectorNetwork = { ...vee(), vertices: vee().vertices.map((v, i) => (i === 1 ? { ...v, mirroring: Mirroring.AngleAndLength } : v)) };
    const edited = setTangent(smooth, 0, Tangent.End, { x: -0.2, y: 0 });
    expect(edited.segments[0].tangentEnd).toEqual({ x: -0.2, y: 0 });
    expect(edited.segments[1].tangentStart).toEqual({ x: 0.2, y: 0 });
  });

  it('a corner vertex keeps the other handle', () => {
    const edited = setTangent(vee(), 0, Tangent.End, { x: -0.2, y: 0 });
    expect(edited.segments[1].tangentStart).toEqual(zero);
  });
});
