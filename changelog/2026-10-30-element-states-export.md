# Element states in HTML and Svelte export

`stateStyleOf` (codegen/states.ts) turns `clip.states` into CSS: `:hover`, `:active`,
`:focus-visible` rules with a `transition` built from the row's ease bezier and duration, and a
base `transition` so leaving the state animates back. Text layers map fill/stroke to `color` /
`-webkit-text-stroke-*`, boxes to `background-color` / `border-*` (`CSS_OF`, one row per key).
React export does not carry states yet.
