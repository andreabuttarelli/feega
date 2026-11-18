# Brand settings move to the dashboard

Brand kit, products, images and video, and the danger zone resolved "the brand" from the project
(`projects.brand_id`), so editing a brand meant opening a canvas. A brand belongs to the org and is
shared by projects, so the scope table now says `brand: dashboard` (`SCOPE_HOME`).

- Routes: `/app/settings/brands` (list + new brand) and
  `/app/settings/brands/<brandId>/{brand,products,video,danger}`. API:
  `/api/v1/me/settings/brands` and `/brands/<brandId>[/<section>]`. `brandChain` builds
  `parent()` as `{ org, project: null, brand }`; the brand comes from the URL and is looked up
  with `org_id = chosen org`, so a brand of another org is a 404.
- Handlers (`pages/brand.ts`, `brand-kit.ts`, `products.ts`, `video.ts`, `danger.ts`,
  `studioActions`, `deleteBrand`) read `parent().brand` instead of `params.projectId`. The "no
  brand" branches are gone: a brand page always has one.
- `loadKit` used a canvas of the project only to build asset thumbnail URLs. Without a project it
  now takes the first canvas of each asset's own project (`assets.project_id`); an asset with no
  project has no thumbnail.
- The project keeps "which brand": `linkBrand`, `unlinkBrand` and now `createBrand` (moved from
  `brand.ts`, sharing `createOrgBrand` with the new brand list). `selectBrand` is dropped,
  `linkBrand` already did it. The Project page also links to "Edit this brand".
- Old `/p/<id>/settings/{brand,products,video,danger}` redirect after the shell loads: to the same
  section of the project's brand, or to `/app/settings/brands` when it has none. The canvas API
  refuses brand sections.
- Removed with the move: `BrandGate`, `requiresBrand`, `sectionRequiresBrand`, `brandGate` in the
  settings shell (it now always lists the org's brands for the sidebar), `settingsScope`
  (only `orgIdOf` used it, and only for the org).
- Dashboard sidebar: a Brands group with "All brands" and one entry per brand.
- Not changed: `video.ts` still reads `content_prefs` from the brand shell, which does not carry it.
