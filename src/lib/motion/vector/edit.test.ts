import { describe, expect, it } from 'vitest';
import { breakAtVertex, deleteVertex, handlesAt, mirrorHandle, removeVertex, splitSegmentAt, toggleSmoothVertex, Tangent } from './edit';
import { Mirroring, Winding, type VectorNetwork } from './model';
import { evalCubic, nearestOnNetwork, networkBounds, segmentCubic } from './curve-math';

const zero = { x: 0, y: 0 };
const line = (start: number, end: number) => ({ start, end, tangentStart: zero, tangentEnd: zero });

const square = (): VectorNetwork => ({
  vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
  segments: [line(0, 1), line(1, 2), line(2, 3), line(3, 0)],
  regions: [{ winding: Winding.NonZero, loops: [[0, 1, 2, 3]] }]
});

const arc = (): VectorNetwork => ({
  vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
  segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 5 }, tangentEnd: { x: 0, y: 5 } }],
  regions: []
});

describe('editing a vector network', () => {
  it('splitting a line adds a vertex on it and keeps the region whole', () => {
    const { network, vertex } = splitSegmentAt(square(), 0, 0.5);
    expect(network.vertices[vertex]).toMatchObject({ x: 5, y: 0 });
    expect(network.segments).toHaveLength(5);
    expect(network.regions[0].loops[0]).toEqual([0, 4, 1, 2, 3]);
  });

  it('splitting a curve keeps its shape', () => {
    const before = evalCubic(segmentCubic(arc(), 0), 0.25);
    const { network } = splitSegmentAt(arc(), 0, 0.5);
    const after = evalCubic(segmentCubic(network, 0), 0.5);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it('removing a vertex between two segments joins them', () => {
    const out = removeVertex(square(), 1)!;
    expect(out.vertices).toHaveLength(3);
    expect(out.segments).toHaveLength(3);
    expect(out.regions[0].loops[0]).toHaveLength(3);
  });

  it('deleting a vertex cuts its segments and drops the regions', () => {
    const out = deleteVertex(square(), 1)!;
    expect(out.segments).toHaveLength(2);
    expect(out.regions).toEqual([]);
  });

  it('breaking a closed path at a vertex opens it', () => {
    const out = breakAtVertex(square(), 0);
    expect(out.vertices).toHaveLength(5);
    expect(out.regions).toEqual([]);
  });

  it('a vertex lists the handles of every segment meeting there', () => {
    expect(handlesAt(square(), 0).map((h) => h.tangent).sort()).toEqual([Tangent.Start, Tangent.End].sort());
  });

  it('mirrors a handle by angle, or by angle and length', () => {
    expect(mirrorHandle({ x: 3, y: 4 }, Mirroring.AngleAndLength)).toEqual({ x: -3, y: -4 });
    expect(mirrorHandle({ x: 3, y: 4 }, Mirroring.Angle, 10)).toEqual({ x: -6, y: -8 });
    expect(mirrorHandle({ x: 3, y: 4 }, Mirroring.None)).toBeNull();
  });

  it('finds the nearest point on the network and its tight bounds', () => {
    expect(nearestOnNetwork({ x: 5, y: 1 }, square(), 2)).toMatchObject({ segmentIndex: 0, x: 5, y: 0 });
    expect(networkBounds(arc()).height).toBeCloseTo(3.75, 6);
  });

  it('alt-click smooths a corner vertex of a network, and back', () => {
    const smooth = toggleSmoothVertex(square(), 1);
    const into = smooth.segments[0].tangentEnd;
    const out = smooth.segments[1].tangentStart;

    expect(into.x * out.x + into.y * out.y).toBeLessThan(0);
    expect(Math.abs(into.x * out.y - into.y * out.x)).toBeCloseTo(0, 6);
    expect(toggleSmoothVertex(smooth, 1).segments[0].tangentEnd).toEqual(zero);
  });
});
