# Compositions load and post over bearer

`/app/compose` joins the dashboard pages (`DashboardPage.Compose`, served by
`/api/v1/me/pages/compose`): `+page.ts` loads through `loadPage`, the template forms and the
canvas node's "Open editor" form submit through `apiEnhance`.

`/app/compose/[nodeId]` gets its bearer twin, `GET|POST /api/v1/compose/[nodeId][?action=]`,
running the page's own load and actions (moved to `$lib/server/compose/editor-page.ts`). Its
`+page.ts` loads with `loadPageData`; save, upload, design-layout and publish go through
`postPageAction`.

`BEARER_PAGES` rows now carry their answer reader: the dashboard endpoint wraps answers
(`{ data }`), the page endpoints do not (ADR 0014). Page query strings (`?project=`) travel to the
API, since `toolScope` reads the project from them.

`tests/e2e/compose.spec.ts` picks a template and lands in its editor with no page-action POST.
