# Code import: pages picked from the file router

Code import asked for page paths typed by hand, up to 8. Users had to know the app's routes, and
dynamic ones had no help at all.

`routes-discover.ts` reads the routes from the file list, one table row per router (Next app and
pages, SvelteKit, Nuxt, Vue pages, Astro, Remix flat routes, React Router `routes.ts` literals,
TanStack Router). It reuses `runPlan` for framework and app folder. The list comes without
booting: the GitHub tree API, the local folder, or the upload's tar listing; only manifests and
the files that may hold param values are read.

Dynamic routes are listed as needing a value. Values come from literal `generateStaticParams` /
`entries`, from a content folder mapping 1:1 to `[slug]`, and after the import from same-origin
links in each captured page's fold (bounded: `tab.ui()` caps at 160 elements, 8 values per
route). No separate crawl: it would need its own time budget.

`MAX_ROUTES` 8 → 20: capture budget 150 s / ~7 s per page ≈ 21. Beyond 20 the import is refused
with the count instead of a schema error. `routes: "all"` imports every static page found. The
import result reports the discovered routes left out and why.

Discarded: a crawl pass after boot (time budget); executing `routes.ts` (code from the repo
never runs on our servers); Next private `_folders` counted as pathless (Next does not route
them — the corpus did, for next-playground).
