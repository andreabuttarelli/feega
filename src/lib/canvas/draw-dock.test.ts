import { describe, expect, it } from 'vitest';
import { DrawTool } from '$lib/motion/draw-tool';
import { DockPlace, DRAW_DOCK, toolsIn } from './draw-dock';

describe('the draw dock: core tools on the bar, the rest in More', () => {
  it('places every draw tool exactly once', () => {
    expect(Object.keys(DRAW_DOCK).sort()).toEqual(Object.values(DrawTool).sort());
  });

  it('keeps only the core tools on the bar, in Figma order', () => {
    expect(toolsIn(DockPlace.Bar)).toEqual([DrawTool.Select, DrawTool.Frame, DrawTool.Rectangle, DrawTool.Ellipse, DrawTool.Text, DrawTool.Pen]);
  });

  it('sends shape builder and the rarer shapes to More', () => {
    expect(toolsIn(DockPlace.More)).toEqual([DrawTool.Line, DrawTool.Arrow, DrawTool.Polygon, DrawTool.Star, DrawTool.Pencil, DrawTool.ShapeBuilder]);
  });
});
