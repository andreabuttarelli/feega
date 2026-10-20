# Position section, constraints that hold

Cause: elements drawn without constraints behave as Scale (fractions of the frame), so every frame resize resized them. `ConstraintsSection` was a separate block that also read as the same thing as the pivot, both labelled "Anchor".

- New elements (`TOP_LEFT_START`, same places as the top-left pivot) are written Left/Top. Saved docs untouched.
- Non-Scale constraints keep the x/y offset (and its keyframes) in pixels; stretch cannot go negative.
- `PositionSection` replaces `ConstraintsSection` and the Anchor row: align to frame, X/Y, constraint selects plus edge widget (`constraints/sides.ts`), rotation, pivot picker, rotate 90, flips.
- "Anchor" is now "Pivot" (rotation/scale origin); "Constraints" is the frame relation.

Known gaps: no live preview of constraints during the canvas drag (applies on release); children of a parent clip follow the parent and ignore constraints; stretch on a rotated clip distorts.
