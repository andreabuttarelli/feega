# Localized pages and split frames get their link

The traidue.com clone serves `/en/wiki` from `src/routes/wiki` through Paraglide's `reroute`. The
import-link matcher compared segments exactly, so no `/en|es|pt/...` page was ever linked. Now
`matchOf` retries without a leading locale tag (`xx` or `xx-YY`) when the path matches nothing as
written. A real route wins: `/og` stays `/og`.

A page board taller than 16384 px is cut by `slicesAt` (`url-doc.ts`) into sibling frames
("traidue.com 2", "3"). `landPlan` returned only `frameIds[0]`, so the parts had no `data.code`
and no link. `UrlImported` now carries `parts`, and `importRoutesInto` remembers the origin and
links every frame in `importedFrames(done)`.

Built on #2279 (per-page links).

Tests: `import-link.test.ts` (locale prefixes), `canvas-import.parts.test.ts`.
