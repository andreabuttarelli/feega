# Redesign the brand creation wizard

`/p/[projectId]/brands/new` had cramped 1px borders, tight padding, and
`--warn` colors that don't exist in tokens (fell back to `#b00`). Visual
pass only: step indicator, panel, fields, and buttons now match the
login page's language (`--line-2`, `--accent` focus ring, primary/ghost
buttons). No change to `STEPS`, form actions, or sessionStorage logic.

Verified in a real browser (chromium, disposable Supabase user) at
1440 and 390px across all seven steps.
