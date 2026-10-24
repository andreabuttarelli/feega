# Frame size presets, plus beside, select layer inside a frame

ST-02, ST-03, SE-12 of the Figma parity roadmap.

- `frame-presets.ts`: Phone, Tablet, Desktop, Presentation, Watch, Paper, Social. `applyPreset`
  goes through `resizeFrame`, so layers pinned with constraints keep their edge distance. Section
  `FramePresetSection` in the frame inspector (no selection); MCP: `preset` on `set_canvas`.
- A custom frame sized to a preset now grows its canvas tile to the doc's aspect
  (`tileFollowsDoc`); before, only the 16:9/9:16/... formats did. Other custom frames stay sized
  by the tile, never by the doc.
- "+" on the right of a frame (`GpuTileChrome`) adds a blank frame of the same size
  (`besideBox`). The button lingers 600 ms after the pointer leaves the tile so it can be reached.
- Frame tool click: first frame 100 by 100, later ones the size of the last drawn one
  (`defaultFrameBox`); it was always the 16:9 tile size.
- Right-click on stacked layers inside a frame lists them under "Select layer"
  (`pickStackAt`, `framePicker.stack`). The list now comes first in the context menu: it was
  below the actions, off screen on long menus.
