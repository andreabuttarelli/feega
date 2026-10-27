# Brand kit in the schema

**Before.** Palette was parsed from colour chips in `brands.content`; fonts, voice, logo
variants and approved assets did not exist. `social_posts` had no brand link (matched by
handle). Pins lived in localStorage.

**Now** (migration `20261027130000_brand_kit.sql`, not applied):

- `brands.palette` / `voice` / `logos` jsonb with shape checks; zod schemas in
  `src/lib/brand-kit.ts`, validated by the MCP write tools (`jsonb-schemas.ts`).
- `brand_fonts(brand_id, role, org_font_id | google_family)`, one per role. It references
  `org_fonts` (feat/org-fonts) and never stores files; the FK is added only if `org_fonts`
  exists when the migration runs.
- `brand_pins(user_id, brand_id, org_id)`, RLS on `auth.uid()` and `auth_org_ids()`.
- `assets.brand_id` + `approved_at`; `social_posts.brand_id`.
- Backfill: palette from hex codes in `content`, `logos.primary` from `logo_url`,
  `social_posts.brand_id` from `social_accounts` by platform + handle.
- Settings → Brand edits the kit; the Brands panel Kit tab reads it
  (`get_brand_library` tab `kit`); `brand_fonts`/`brand_pins` join `ORG_TABLES` for MCP `query`.
- `database.types.ts` was edited to match the migration because it can't be regenerated
  before the migration is applied. Run `npm run db:types` after applying it.

Not done: new social post ingests do not set `brand_id` (the feed node has no brand); the
reader also matches by handle.
