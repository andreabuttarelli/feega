import { DrawTool } from '$lib/motion/draw-tool';

export enum DockPlace {
  Bar = 'bar',
  More = 'more',
  Palette = 'palette'
}

export const DRAW_DOCK: Record<DrawTool, DockPlace> = {
  [DrawTool.Select]: DockPlace.Bar,
  [DrawTool.Frame]: DockPlace.Bar,
  [DrawTool.Rectangle]: DockPlace.Bar,
  [DrawTool.Ellipse]: DockPlace.Bar,
  [DrawTool.Text]: DockPlace.Bar,
  [DrawTool.Pen]: DockPlace.Bar,
  [DrawTool.Stack]: DockPlace.More,
  [DrawTool.Line]: DockPlace.More,
  [DrawTool.Arrow]: DockPlace.More,
  [DrawTool.Polygon]: DockPlace.More,
  [DrawTool.Star]: DockPlace.More,
  [DrawTool.Pencil]: DockPlace.More,
  [DrawTool.ShapeBuilder]: DockPlace.Palette
};

export const toolsIn = (place: DockPlace): DrawTool[] => (Object.keys(DRAW_DOCK) as DrawTool[]).filter((tool) => DRAW_DOCK[tool] === place);
