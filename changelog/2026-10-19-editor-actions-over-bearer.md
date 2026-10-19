# Frame editor posts its actions over bearer

The frame editor page's `load` and actions moved to `$lib/server/motion/editor-page.ts` (pure
move) and are served by `GET|POST /api/v1/projects/[projectId]/canvases/[canvasId]/motion/[nodeId][?action=]`
through `servePage` (`$lib/server/api/bearer-page.ts`, now shared with the canvas endpoint).
Same handlers, user actor: unlike `/api/v1/motion/[nodeId]/ops`, which is the agent dialect.

Client side, one router: `postPageAction(pageUrl, action, form)` (`$lib/api/page-action.ts`). A
table (`BEARER_PAGES`) maps the canvas and editor page paths to their API twin; any other page
(compose, render link) keeps posting `?/action`. Motion components serve both the editor and the
compose page, so they pass the page URL and the table decides — moving compose later is a row.

Callers switched: editor ops/analyze/uploadFont/templateSounds/branches and the rest of the
shell, poster (editor, canvas tile, compose), still, sound, export, templates, publish dialog.

Still on the page: the editor `load` (SSR), compose, render link, embed/preview/source routes.
