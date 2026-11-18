# Code imports capture pages four at a time

`captured` in `import-code.ts` opened one browser tab per page and waited for each to load, settle
and be read before opening the next, so a folder or repo import of 15 routes paid 15 page loads in
a row. Now the first page is captured alone — it warms the dev server, which compiles a route on
its first request, and carries the sign-in — and the rest go through a pool of `CAPTURE_TABS` (4)
tabs. Results are folded back in route order, so frames, missed pages and the last refusal come
out exactly as before. The time budget still stops new pages from starting once it is spent.

Expected effect: the capture phase drops from N page loads to about 1 + (N-1)/4 (15 routes: 15
→ 5). Not measured on a real project yet. Install and dev-server start are unchanged.

The views fixture in `code-views.test.ts` returned one shared fake tab to every `open()`, so its
viewport width leaked between pages once they ran together; it now gives each open its own tab,
like the real browser does.
