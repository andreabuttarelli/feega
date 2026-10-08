# Six showcase videos in the gallery seed, and fields that drive several clips

**Before.** The six showcase films in `~/Documents/feega-videos/showcase/` (liquid-type,
launch-film, material, numbers, logo-sting, drop) existed only as local renders. Their build
scripts named assets by `http://localhost:879x/` (the doc itself only by asset id). Three of them
exposed no template field, so a remix got whatever `exposeMainFields` guessed. In drop the price
was one Text clip per digit, generated from `COPY.price`, and the accent was set in four clips
in four scenes: a remixer had to change it four times, and could not change the price at all.

**Now.**

- `ExposedField.also` (≤ `MAX_LINKED`): more `{clipId, prop}` the same value writes.
  `setField` writes all of them, `exposeField` refuses a missing one, `expose_field` takes
  `also`. One accent field now recolours every scene.
- `SHOWCASE` in `scripts/seed-gallery.ts`: 13 items, one per cut, as the existing seed does.
  Every asset (music, logo, product) is a local file the seed copies to
  `media/gallery/<itemId>/` (ADR 0006); the music licence (CC0-1.0) goes into the audio asset
  name.
- `seedProblems` refuses an item that still names a local server, ships no file for an asset,
  has no preview or poster, or offers a remixer nothing to edit. `main` skips it with the
  reason.
- Build scripts (outside the repo) rebuilt on current main: docs identical except the new
  fields; docProblems 0 blocking for all 13. Drop's price is now one `Price` custom
  component (`price.js`, params `price` and `currency`), so drop was re-rendered locally.

**Discarded.** A doc-level colour token: tokens come from the remixer's brand, so the showcase
look would be lost on remix. Duplicate field keys: the field form keys its rows by `key`.
