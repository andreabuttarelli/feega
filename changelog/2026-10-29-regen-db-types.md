# Regenerate database types from production

`src/lib/database.types.ts` regenerated from `klnswzhhgrqvbfjzioul`.

- Adds `canvas_comments`, `canvas_conflicts`, `session_id` columns and other tables that were missing.
- Drops `org_fonts`, `org_uncensored_optins`, `brand_fonts`: migrations not applied in production.
- `canvas-comments.ts` left as is.
