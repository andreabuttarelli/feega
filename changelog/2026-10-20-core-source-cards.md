# Core cards: feeds, stores and influencers

In `?renderer=core` a social feed, a products node and an influencer were drawn with the generic title/subtitle face. They now follow the DOM components (`SourcePreview`, `InfluencerNode`): header with the kind icon, title and `shown/total` count, a rule, a three-column grid of square tiles (carousel/video badge top-right, sale chip top-left, price caption at the bottom), the empty and sync-failed states; the influencer is a cover over a name and views band.

The face carries `tiles` (thumb, caption, badge, sale) instead of a bare `thumbs: string[]`, so the page hands `viewOf(id)` (`feedView`/`productsView`/`personView` in `source-thumbs.ts`) to the flow instead of `thumbsOf`. Layouts live in `core/source-card.ts`; the shared primitives moved to `core/card-kit.ts` in a separate commit (no behavior change).

Header and band heights are measured from the DOM, not derived: if `SourcePreview` spacing changes, `HEAD`/`PERSON` in `source-card.ts` move with it.

Not done: tile icon placeholder for a missing thumbnail, the Pixi scene (`scene.ts`) still has no Preview/Person surface (it already had none for List/Doc).
