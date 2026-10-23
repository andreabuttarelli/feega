# Push instance overrides to the main component

An instance could drift from its main but never feed back: the only way to apply a tweak to
every copy was to open the main and redo it by hand.

- `pushOverrides` (`main-component.ts`) bakes the instance's overrides into the main comp and
  clears them on that instance. Other instances keep what they override themselves and follow the
  main for the rest. `detachInstance` shares the same baking step.
- Command `push-instance`: Properties button "Push to main", Layer menu, selection actions. MCP:
  `component` action `push` (folded into the existing tool for the 30k chat budget).
