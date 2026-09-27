# Redesign the brand creation wizard

`/p/[projectId]/brands/new` had cramped 1px borders, tight padding, and
`--warn` colors that don't exist in tokens (fell back to `#b00`). Visual
pass only: step indicator, panel, fields, and buttons now match the
login page's language (`--line-2`, `--accent` focus ring, primary/ghost
buttons). No change to `STEPS`, form actions, or sessionStorage logic.

Verified in a real browser (chromium, disposable Supabase user) at
1440 and 390px across all seven steps.

First pass wrapped the step chips to a second line (OVERVIEW alone) and
squeezed the handle input to ~90px at 390. Replaced the chip row with a
single-row segmented progress bar plus a "Step N of 7 · Label" caption
— one row at every width instead of two responsive layouts — and let
`.handle-row` wrap: select stays inline, input drops to its own full
row, Remove below it.
