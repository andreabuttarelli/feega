# Text inspector: resizing in Layout, size presets

Before: the text resizing choice (auto width / auto height / fixed) sat in the Advanced type
popover, W/H gave no hint of which axis follows the text, and size had no presets.

- `sizing` tier is `Hidden` in Typography; Layout renders it as a segmented above W/H.
- `axisModes` in `text-sizing.ts` derives Hug/Fixed per axis from the existing `FOLLOWS` table,
  so canvas fit and inspector labels cannot disagree. W/H show it as a trailing tag.
- Size gets a presets select (12–96) via a new `trailing` arg on `rangeField`.
- Header create-component was already inline for any selection (#1714); a test pins it for text.

Not done: W/H tags are read-only; the segmented switches the mode.
