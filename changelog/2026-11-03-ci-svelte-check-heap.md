# CI: svelte-check heap raised to 8 GB

`test` failed with a V8 out-of-memory crash (heap capped near 4 GB) in the svelte-check step.
Runner has 16 GB; the step now runs with `NODE_OPTIONS=--max-old-space-size=8192`.
Scope unchanged: same tsconfig, same coverage. Splitting by workspace was discarded as a larger change.
