# Stack tool in the add bar, shape builder out of it

Stack: a DrawTool that draws an empty transparent Shape rect with vertical auto layout (gap 8, padding 16, hug).
Built through the FINISH table in draw-create.ts; reuses the optimistic ghost path.

Shape builder moved to DockPlace.Palette: gone from bar, "+" menu and mobile sheet; X and the command palette remain.

Insert menu: insertMenuMaxHeight(barTop, topInset) fits it to the viewport on open, timeline lift and resize.
