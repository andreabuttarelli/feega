# Remove old-product emails, rubrics, hygiene and analytics docs

Leftovers of the social autopilot with no caller in the canvas product.

Removed:
- `email.ts`: onboarding recap, strategy-plan-ready, weekly recap and
  agent-notify templates with their helpers; `email-i18n.ts` keeps only the
  password-reset and invite strings that are still sent.
- `rubrics.ts`, `platform-hygiene.ts` (only rubrics imported it).
- `POST|GET /api/v1/analytics/visual/backfill` and `visual-meta.ts`
  (backfilled `post_visual_meta` for published posts).
- `/docs/api/analytics` page, its nav entry, sitemap entry and strings.
- `docs/api`: the posts page, calendar/publishing/ads sections, stale gated
  endpoints in the overview.
- `schema-drift-known.json` entries pointing at deleted code.
