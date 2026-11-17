# The import capture waits for hydration and images

The traidue.com wiki articles imported without their side TOC and with a grey hero image.

What the TOC is (`src/lib/components/wiki/TOC.svelte` in the clone):
- client-only: an `$effect` collects `article h2, h3` after mount, so the server HTML has none;
- not lazy: its `IntersectionObserver` only highlights the active entry;
- shown from `lg` (1024 px), below the 1280 capture width.

So a capture that reads the page before hydration finishes misses it. `settle` waited for
network idle, fonts and 300 ms of DOM quiet; a component that renders after a quiet gap longer
than that was lost. Now the first `settle` after each `goto` waits for 1 s of DOM quiet (capped
at 6 s), and every `settle` turns lazy images eager and awaits their decode (capped at 5 s).
Later settles keep the 300 ms window, so a page costs at most one longer wait.

Not verified on the clone: whether the real TOC was missed for this reason or because the page
failed to hydrate. The fixture reproduces the timing case only.

Test: `page-hydrated.browser.test.ts` (needs `CHROMIUM_PATH`), a sidebar rendered 2.5 s after load
plus a lazy image. It fails on the old wait and passes now.
