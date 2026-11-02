# A canvas opened with a website to import shows the import dialog again

A signup carrying a website lands on `/p/<id>/c/<id>?start_url=<site>`: the canvas
should open the URL import dialog on that site. It threw
`Cannot read properties of undefined (reading '$set')` and showed an empty canvas, on
`main` too.

`takeStartUrl` ran in an `$effect` during hydration and called `replaceState`, which in
SvelteKit writes to the root component — not assigned yet while the page is mounting.
It now runs in `afterNavigate`, after the router has started.

Found in the pre-release browser sweep. Guard: `tests/e2e/canvas-start-url.spec.ts`.
