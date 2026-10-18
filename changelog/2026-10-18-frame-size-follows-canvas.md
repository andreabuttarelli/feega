# Frame node size follows its doc canvas

Frames created by API (`create_node` type motion, then `set_canvas`) had node size null and
were drawn as a 16:9 video card. Now:

- `create_node` of a motion node writes the stage size of its format.
- `saveMotionDoc` (the one doc save path) resizes a frame node to its doc aspect, keeping its
  width (`docNodeSize` in `motion-node.ts`). Elements and groups keep their canvas size.
- New canvas op `draw_frame {canvasId,x,y,w,h?,format?}`, same path as the page action
  `drawFrame` (`drawFrameAt`); CLI `feega canvas frame`, MCP `canvas_tool` description.
- Chat generic-op description shortened to stay under the tool budget.
