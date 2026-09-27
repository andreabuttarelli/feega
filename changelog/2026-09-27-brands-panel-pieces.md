# Brands panel: expandable brands, every piece draggable; wizard without competitors

Before, the canvas Brands panel showed each brand as one row where only the logo and the name
were draggable (the name dropped name + description together as one text node). Colours,
handles, catalogue and website were reachable only from the brand page, and not all of them.

## What changed

- **A brand is an accordion, not a drag source.** Header = logo + name + chevron, collapsed by
  default; open state per project in `localStorage` (`feega:brands-panel-open:<projectId>`,
  wrapped in try/catch). Expanding fetches
  `GET /api/v1/projects/[projectId]/agent/brands/[brandId]` → `loadBrandDetails`
  (`src/lib/server/brand-details.ts`): website, colour swatches (asset created up front, because
  `dragstart` is synchronous), handles (connected `social_accounts` ∪ `platform:@handle` chips in
  the content, deduped), stores (distinct `products.platform/store_url` of the brand).
- **One table**, `PIECE_DRAG` in `src/lib/canvas/brand-pieces.ts`: logo → image, name →
  text, description → text, content → doc, colour → image (swatch), handle →
  social_account_feed, store → products, website → iframe. `brandPieces` lists only pieces that
  exist and can build a node. Nodes carry `assetId`, never a URL.
- `FilledNodeDrag` accepts `products` and `iframe`.
- **Two latent defects found in the browser walk, both fixed test-first:**
  - Colour swatches failed with RLS: `upload(..., { upsert: true })` needs SELECT + UPDATE
    policies on `storage.objects`, and `media/colours/<orgId>/` only had INSERT/DELETE.
    Migration `20260927190000_media_colour_upsert.sql` (applied). This also broke colour chips
    on the brand page.
  - `GET /p/.../c/.../assets/[id]` tried to sign an `imported` asset whose url is an absolute
    public URL → 404, so every dragged logo/swatch rendered empty. Now redirects to it.
- **Competitors step removed from the new-brand wizard** (product decision). `WIZARD_STEPS` and
  `restoreWizardState` in `src/lib/brand-wizard-steps.ts`: a saved draft on the old
  `competitors` step reopens on `handles`, and `competitorHandles` is dropped from old drafts.
  `composeWizardContent` no longer writes a `## Competitors` section. Existing brands keep
  whatever their content already says.

## Discarded

- A `brand_competitors` table (asked, then withdrawn before any migration was applied).
- Persisting the wizard's site images: `analyzeWizardSite` returns external URLs and nothing
  stores them; re-hosting means a fetch + upload per image and a place to keep them per brand
  (no column/table exists). Not cheap, not done — the panel has no "images" piece yet.
