# Shell reskin on the greyscale roles

**Why.** The tokens PR added the ramp and roles but left the legacy `--ui-*` values; the shell
still read flat.

**What.**

- Legacy `--ui-bg/surface/hover/line/ink*/field/raised/grid` and `--canvas-bg/dot` now point at
  the roles, so every surface that used them moves to the ramp in both themes. The dark theme
  inverts its old elevation: canvas `#121212`, bars `#181818`, panels `#1f1f1f`, raised `#272727`.
- shadcn `--sh-*` tokens point at the roles too.
- Layers: 28px rounded rows, selection in accent wash + AA accent text, eye/lock revealed on hover
  (always on touch). Left panel: 40px header, 13px semibold title, close is an `IconButton` with
  its tooltip and `Esc`. Rail: 32px rounded buttons, wash/pressed/selected states, focus ring.
- Top bar: 28px switchers and actions on the radius scale, credits as a mono pill, chat toggle
  without a border; legacy `--ink/--paper/--line` replaced by roles in the shell components.
- Bottom bar: floating raised bar, `lg` radius, float shadow, 32px tools, dark tooltip.
- Menus, popovers, tooltips, dialogs, sheets (shadcn): raised surface, `md`/`lg` radius, 28px
  rows, caps section labels, mono shortcuts.
- Every solid accent under white text (`share`, `render`, export…) uses `--ui-accent-solid`, AA.
- `cn` knows `text-ui-*` sizes are not colours (they were dropped next to a text colour).

**Not done here.** The Properties panel content belongs to the inspector redesign; the timeline
and chat panel follow the tokens only. Behaviour is unchanged.
