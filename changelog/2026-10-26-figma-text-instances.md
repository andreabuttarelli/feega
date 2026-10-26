# Figma paste: tiny text and component instances

Before: text whose size or box fell under the motion minimum (12 px text in a 6000 px frame)
was refused by the schema and vanished. Component instances were flattened into plain groups,
so editing the main did not touch them.

Now: `TYPE_SIZE.min` is 0.001 (was 0.01) and `textClip` keeps the left edge while widening a
box under 0.02. An instance whose main is in the paste becomes a Precomp of one main
component (`createComponent` on the first instance), placed again per instance with an offset
(`FrameLayer.component`, `Place.mains` in `figma-doc.ts`). Without the main it stays a
group named after the component.

Discarded: scaling a clamped text clip with a transform, since the pivot moves the text.
Overrides on instances are still ignored.
