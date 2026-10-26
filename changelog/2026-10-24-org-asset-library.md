# Org asset library (FL-14)

**Before:** an asset belonged to one project; reusing it elsewhere meant uploading it again.

**Now:** "Save to library" on any asset tile copies the row with `project_id` null, which is
already the schema's meaning of "org library" (`listOrgAssets`). Assets > Library lists those rows
in every project of the org; tiles drag onto a canvas like any other. Saving the same file twice
returns the existing row (matched on `org_id` + `url`).

**Decisions:** no migration: `assets.project_id` was already nullable and RLS is by `org_id`, so
another org cannot read the rows. The copy shares the storage object with the original; nothing in
the server deletes storage on project removal today, so the library copy outlives its source. A
folder/Elements/Styles split is not built: one flat library.

**Tests:** `org-library.test.ts`, `tests/e2e/org-library.spec.ts`.
