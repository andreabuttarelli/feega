# Docs restyled to the blog's look

docs.feega.app now matches blog.feega.app: same neutral palette (#111 /
#0a0a0a), orange accent, flat white sidebar, -0.04em headings, 17px body,
hairline-underlined links that turn orange on hover.

- Only `web-docs/src/styles/feega.css` changed; Starlight keeps sidebar,
  search, generated pages, guides.json and the CSP.
- Discarded a shared CSS file: the two sites build and deploy as separate
  Vercel projects with their own `public/fonts`; the overlap is the
  @font-face block and six colours, not worth a cross-project import.
