import { describe, expect, it } from 'vitest';
import { MIXED } from '$lib/motion/mixed';
import { BoxField, fieldValue, scaledTo, selectionBox, turnedAbout, withField } from './selection-box';

const a = { id: 'a', x: 0, y: 0, w: 100, h: 50, rotation: 0 };
const b = { id: 'b', x: 200, y: 100, w: 100, h: 100, rotation: 0 };

describe('the box around several selected nodes', () => {
  it('spans every node', () => {
    expect(selectionBox([a, b])).toEqual({ x: 0, y: 0, w: 300, h: 200 });
  });

  it('counts the corners of a turned node', () => {
    const turned = { id: 'c', x: 0, y: 0, w: 100, h: 100, rotation: 45 };
    const box = selectionBox([turned]);

    expect(box.w).toBeCloseTo(100 * Math.SQRT2);
    expect(box.x).toBeCloseTo(50 - 50 * Math.SQRT2);
  });

  it('scales every node with the box, positions and sizes alike', () => {
    const from = selectionBox([a, b]);
    const [sa, sb] = scaledTo([a, b], from, { x: 0, y: 0, w: 600, h: 100 });

    expect(sa).toMatchObject({ x: 0, y: 0, w: 200, h: 25 });
    expect(sb).toMatchObject({ x: 400, y: 50, w: 200, h: 50 });
  });

  it('turns every node about the box centre and adds the angle to each', () => {
    const [ta, tb] = turnedAbout([a, b], { x: 150, y: 100 }, 180);

    expect(ta.x).toBeCloseTo(200);
    expect(ta.y).toBeCloseTo(150);
    expect(ta.rotation).toBe(180);
    expect(tb.x).toBeCloseTo(0);
    expect(tb.y).toBeCloseTo(0);
  });

  it('reads a field as Mixed when the nodes differ, the value when they agree', () => {
    expect(fieldValue([a, b], BoxField.X)).toBe(MIXED);
    expect(fieldValue([a, b], BoxField.W)).toBe(100);
    expect(fieldValue([a, b], BoxField.Rotation)).toBe(0);
  });

  it('writes a field on every node', () => {
    expect(withField([a, b], BoxField.Y, 30).map((n) => n.y)).toEqual([30, 30]);
    expect(withField([a, b], BoxField.H, 80).map((n) => n.h)).toEqual([80, 80]);
    expect(withField([a, b], BoxField.Rotation, 400).map((n) => n.rotation)).toEqual([40, 40]);
  });
});
