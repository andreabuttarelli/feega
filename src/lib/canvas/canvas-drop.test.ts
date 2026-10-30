import { describe, expect, it } from 'vitest';
import { Carry, carryOf, fractionIn, hostShift, hostTurn, isOutside } from './canvas-drop';

describe('where a drop lands inside a frame', () => {
  const stage = { left: 100, top: 50, width: 200, height: 100 };

  it('is the fraction of the frame stage under the pointer', () => {
    expect(fractionIn(stage, { x: 150, y: 75 })).toEqual({ x: 0.25, y: 0.25 });
  });

  it('a point just outside the stage edge is held on the edge', () => {
    expect(fractionIn(stage, { x: 90, y: 200 })).toEqual({ x: 0, y: 1 });
  });
});

describe('an element dragged off its frame', () => {
  const stage = { left: 0, top: 0, width: 100, height: 100 };

  it('is outside once the pointer leaves the stage, not before', () => {
    expect(isOutside(stage, { x: 100, y: 50 })).toBe(false);
    expect(isOutside(stage, { x: 101, y: 50 })).toBe(true);
    expect(isOutside(stage, { x: 50, y: -1 })).toBe(true);
  });
});

describe('a press on an element inside a frame', () => {
  const frame = { left: 0, top: 0, width: 100, height: 100 };
  const down = { x: 50, y: 50 };
  const inside = { x: 50, y: 50 };
  const outside = { x: 140, y: 50 };

  it('is no drag while the pointer stays within a few screen pixels of where it went down', () => {
    expect(carryOf({ down, now: { x: 53, y: 52 }, started: false, frame, world: inside })).toBe(Carry.Held);
  });

  it('a double-click with jitter on a frame drawn elsewhere never carries anything out', () => {
    expect(carryOf({ down, now: { x: 52, y: 49 }, started: false, frame, world: outside })).toBe(Carry.Held);
  });

  it('drags inside once the pointer travels past the slop', () => {
    expect(carryOf({ down, now: { x: 55, y: 50 }, started: false, frame, world: inside })).toBe(Carry.Within);
  });

  it('carries out only once a started drag leaves the edited frame', () => {
    expect(carryOf({ down, now: { x: 51, y: 50 }, started: true, frame, world: outside })).toBe(Carry.Out);
    expect(carryOf({ down, now: { x: 51, y: 50 }, started: true, frame, world: inside })).toBe(Carry.Within);
  });
});

describe('a gesture on a free element moves or sizes its node', () => {
  const from = { x: 100, y: 100 };
  const to = { x: 130, y: 120 };

  it('a move shifts the node and keeps its size', () => {
    expect(hostShift(null, from, to)).toEqual({ dx: 30, dy: 20, dw: 0, dh: 0 });
  });

  it('the bottom-right corner grows the node and keeps its corner', () => {
    expect(hostShift([1, 1], from, to)).toEqual({ dx: 0, dy: 0, dw: 30, dh: 20 });
  });

  it('the top-left corner moves the corner and shrinks by as much', () => {
    expect(hostShift([0, 0], from, to)).toEqual({ dx: 30, dy: 20, dw: -30, dh: -20 });
  });

  it('a rotate grip turns the node by the angle swept around its centre', () => {
    const centre = { x: 0, y: 0 };
    expect(hostTurn(centre, { x: 10, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(90);
    expect(hostTurn(centre, { x: 10, y: 0 }, { x: 0, y: -10 })).toBeCloseTo(-90);
    expect(hostTurn(centre, { x: -10, y: 1 }, { x: -10, y: -1 })).toBeCloseTo(11.42, 1);
  });

  it('a side handle sizes one axis only', () => {
    expect(hostShift([0.5, 1], from, to)).toEqual({ dx: 0, dy: 0, dw: 0, dh: 20 });
  });
});
