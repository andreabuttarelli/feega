# Favicons and share image: feega, not dazero

Every icon in `static/` (favicon 16/32/48, apple-touch, 192/512, og.png) still
showed the dazero wordmark. Regenerated from `logo.jpg` (feega mark) with
`sips`: small favicons from a tighter crop so the mark reads at 16px; og.png is
the mark centred on #111111 at 1200x630. `favicon.svg` (dazero) removed from
`app.html` and the manifest, since no vector feega mark exists in the repo;
theme/background colour set to #111111 to match the mark.
