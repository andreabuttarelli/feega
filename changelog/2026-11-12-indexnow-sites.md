# IndexNow for the blog and docs

Only feega.app was notified after a deploy. `scripts/indexnow/` now takes
the deploy project as argument (`feega-landing`, `web-blog`, `web-docs`),
reads the host, sitemap and key from one table (`sites.ts`), follows a
sitemap index to its children and submits only URLs on that host.

- One key for all three hosts; each serves `<key>.txt` from its own root
  (`landing/static`, `web-blog/public`, `web-docs/public`).
- `deploy.yml` runs it after the production deploy of those three projects.
  Unchanged semantics: the step runs only when that project deployed, and a
  non-2xx answer fails the step (the deploy is already live).
- Discarded: submitting only changed URLs. The sitemaps carry no `lastmod`
  to diff; the full list (tens of URLs) goes each time, well under the
  10,000 per request limit.
- Moved from `landing/scripts/` to `scripts/indexnow/` so the root test job
  runs its tests.
