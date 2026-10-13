# Poster parts are selectable and editable on the canvas

**Before.** A poster is one Custom clip whose script lays everything out; on the canvas it was
one box, edited only through its fields in Properties.

**Now.** Posters tag the element that draws each field with `data-part="<field>[:<index>]"`
(type grid and checker steps tagged here; the nine posters from #488/#489 already were). The
measure script returns those boxes too, keyed `clip#part`. In the selection overlay a click on a
selected poster picks the smallest part under the pointer (dashed box, corner marks);
double-click opens a text box over it and writes the field, or that one line of a multi-line
field, through `setProps` — so undo, saving and the agent's `set_props` stay the same path.
Properties narrows to the part's field; Layers lists parts under their clip and selects them.

The type grid kept only non-blank lines and numbered them after filtering; it now carries each
line's index in the raw field, so `lines:3` is always line 3 of what the user typed.

**Also.** The preview player shrank its 1920px frame with a CSS transform; the frame is an
out-of-process iframe, so Chrome downscaled the full raster and small previews were soft. The
scale is now CSS `zoom` on the iframe (`crisp-scale.ts`): the child renders at the shown size.

**Not done.** Dragging or resizing a part does not write layout fields yet: which field a
gesture should change (margin, size, fill) differs per poster and needs a per-template map.
