# Core cards: empty nodes

`ads`, `social_post_mockup`, `calendar` have no component on the default canvas: it draws `EmptyNode` (dashed card, icon badge, name, hint). Core drew a title/subtitle or caption face. Now `Surface.Empty` (`core/empty-card.ts`) draws the same: dashed 1px border, 40px badge, 13px title, hint wrapped at 28ch, centred. `studio_batch` draws its pick state (icon over an underlined "Open Photo studio").

Text in the new layouts uses -0.8px tracking (`write`/`measure` in `card-kit.ts`), as the DOM does; width checked against Chrome: hint 204.1px, title 21.5px.

Not done: studio batch with options or a picked batch (data fetched by the DOM component), `select`, `iframe`, `effects`, `composition`.
