# Motion editor e2e back to green, two touch regressions fixed

8 of 31 tests in `motion-editor`, `motion-touch`, `auto-layout` failed on dev
(real stack, chromium).

**Real regressions (fixed, the e2e were the red tests):**

- Timeline "More actions" was unclickable at its centre: after the chrome
  reskin (#549) the toolbar padding shrank and the button sat under the side
  column's 44px resize edge (`z-index: 20`, 22px over its left neighbour).
  `SideColumn` now isolates its stacking context, so the edge stays inside
  the column's layer and the later timeline paints above the overlap, as it
  already did in the canvas mount.
- On touch, the Layer section's Opacity field was 15px wide (fixed 124px box
  holding a 44px label and a 40px keyframe button). On coarse pointers the row
  wraps and the number takes its own full-width line.

**Stale tests (updated, assertions unchanged):**

- 44px audit flagged the chat's `sr-only`, `aria-hidden` file input: skipped
  as not a touch target.
- Preview zoom: one ⌘= step now covers the whole stage at 1280×720, so there
  was no "around" to double-click. Viewport made taller.
- Empty-lane drag: fit-to-width zoom leaves no lane after the last clip, and
  the 180px tablet timeline shows less than one row once a clip is selected.
  The test grows the timeline by finger first, drags left of the clip, and
  asserts the point is a lane.

Open: the cramped tablet timeline (180px default, ~35px of lanes with the clip
bar shown) is a design call, not changed here.
