import { describe, expect, it } from 'vitest';
import { FillType } from '../fill/model';
import { ShapeKind } from '../shape/schema';
import { MAX_STROKES, StrokeAlign, addStroke, moveStroke, removeStroke, setStroke, sidesShown, strokeSchema, strokesOf, strokesSchema } from './model';

describe('stroke stack model', () => {
  it('a fresh stroke is a centred solid line with butt caps and miter joins', () => {
    expect(strokeSchema.parse({ paint: { type: 'solid', color: '#000000' } })).toMatchObject({ width: 0.01, align: StrokeAlign.Center, dash: 0, gap: 0, cap: 'butt', join: 'miter', visible: true });
  });

  it('a stroke paints with a colour or a gradient, never a picture', () => {
    expect(strokeSchema.safeParse({ paint: { type: 'image', assetId: 'x' } }).success).toBe(false);
    expect(strokeSchema.safeParse({ paint: { type: 'linear-gradient', stops: [{ color: '#000', pos: 0 }, { color: '#fff', pos: 1 }] } }).success).toBe(true);
  });

  it('per-side widths are four numbers: top, right, bottom, left', () => {
    expect(strokeSchema.safeParse({ paint: { type: 'solid', color: '#000' }, sides: [0.01, 0, 0.02, 0] }).success).toBe(true);
    expect(strokeSchema.safeParse({ paint: { type: 'solid', color: '#000' }, sides: [0.01, 0] }).success).toBe(false);
  });

  it('only a rectangle takes per-side widths', () => {
    expect(sidesShown(ShapeKind.Rect)).toBe(true);
    expect(sidesShown(ShapeKind.Ellipse)).toBe(false);
    expect(sidesShown(ShapeKind.Path)).toBe(false);
  });

  it('a shape from before with no stroke has none', () => {
    expect(strokesOf({ strokeKind: 'none' })).toEqual([]);
    expect(strokesOf({})).toEqual([]);
  });

  it('a legacy solid stroke reads as one centred layer with its width, dash, cap and join', () => {
    expect(strokesOf({ strokeKind: 'solid', stroke: '#111111', strokeWidth: 0.02, dash: 0.03, gap: 0.01, cap: 'round', join: 'bevel' })).toEqual(
      strokesSchema.parse([{ paint: { type: 'solid', color: '#111111' }, width: 0.02, dash: 0.03, gap: 0.01, cap: 'round', join: 'bevel' }])
    );
  });

  it('a legacy gradient stroke becomes a linear paint from the old fill colours, so it renders the same', () => {
    const [s] = strokesOf({ strokeKind: 'gradient', fill: '#ff0000', fill2: '#0000ff', gradientAngle: 45 });
    expect(s.paint).toMatchObject({ type: FillType.Linear, angle: 45, stops: [{ color: '#ff0000', pos: 0 }, { color: '#0000ff', pos: 1 }] });
  });

  it('a stored stack wins over the legacy fields', () => {
    expect(strokesOf({ strokeKind: 'solid', stroke: '#111111', strokes: [] })).toEqual([]);
  });

  it('add, set, move and remove keep the stack valid and capped', () => {
    let s = addStroke([]);
    s = addStroke(s);
    expect(s).toHaveLength(2);
    s = setStroke(s, 0, { align: StrokeAlign.Outside, width: 0.05 });
    expect(s[0]).toMatchObject({ align: 'outside', width: 0.05 });
    expect(moveStroke(s, 0, 1)[1].align).toBe('outside');
    expect(removeStroke(s, 0)).toHaveLength(1);
    expect(() => setStroke(s, 0, { width: 5 })).toThrow();
    let many = addStroke([]);
    for (let i = 0; i < MAX_STROKES + 2; i++) {
      many = addStroke(many);
    }
    expect(many).toHaveLength(MAX_STROKES);
  });
});
