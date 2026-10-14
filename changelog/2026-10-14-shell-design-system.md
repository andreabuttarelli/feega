# Shell design system: greyscale ramp, roles, radius scale, primitives

**Why.** The shell had one white for every bar and panel, one grey for the canvas, and dark
panels darker than the canvas they framed: areas did not read apart, and panel titles, section
labels and rows shared the same size and weight. The primary blue under white text was 3:1.

**What.**

- `src/app.css`: a 13-step pure-grey ramp (`--grey-0…12`) per theme, and semantic roles on top
  (`--ui-app`, `--ui-canvas`, `--ui-panel`, `--ui-panel-sunken`, `--ui-panel-raised`,
  `--ui-input`, `--ui-wash`, `--ui-pressed`, `--ui-divider*`, `--ui-text*`, `--ui-icon-ink`,
  `--ui-accent-solid`, `--ui-accent-text`, `--ui-selected`, shadows, tooltip). Type roles, row
  heights, icon sizes, motion durations and a radius scale (`--ui-radius-none/xs/sm/md/lg/full`).
- `src/lib/styles/tailwind.css`: the roles as Tailwind colours (`bg-ui-panel`, `text-ui-text-2`…),
  type sizes (`text-ui-label`…), shadows, and `--radius-*` mapped to the scale.
- `src/lib/components/ui/shell/`: Panel, PanelHeader, Section, Row, Field (+ `FIELD_INPUT`),
  IconButton (tooltip + shortcut built in), SegmentedControl, Toolbar, Hint, Kbd, Menu*.
- `greyscale-tokens.test.ts` resolves `var()` chains and checks the ramp's order, AA for every
  text role on every surface role, the elevation steps, and white on the solid accent.

**Decisions.** The "circles or rectangles" rule is lifted by the user: radii follow a scale with
one role per step (CLAUDE.md, DESIGN.md). The two tests that forbade `rounded-`/`border-radius`
in the canvas switchers are removed; template-content tests keep their own rules. The bright
`#0099ff` stays for outlines and focus; text and fills under white use `#0b6bcb`. Legacy
`--ui-bg/--ui-surface/…` keep their values here: remapping them to the roles is the reskin,
in its own PRs.
