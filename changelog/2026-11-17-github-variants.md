# Variants on push

`frameVariant` (`code-push/variants.ts`) duplicates a linked frame (`duplicateNodes` behind a `duplicate` port) and copies its links with `variant_of` set and push state cleared. Plain duplicate copies no `frame_code_links` rows, so it stays unlinked.

`framesPush` plans variants first: a variant with no answer refuses `variant_choice` with a suggested route (`/pricing-variant`, `/home-variant`); `keep` drops it from the push; `replace` pushes as usual; `new_route` keeps only the edited entry file and moves it to `routeFileOf(link, route)` (same convention as the source page; route groups not handled). An unedited variant pushed as a new route writes nothing.

Migration `20261117190000_frame_code_links_variant_of.sql`, not applied in prod. Surfaces: popover "Make variant", Changes panel choice prompt, `POST /github/push/variant`, `github_variant` op, `feega github variant`, push `variants` / `--variant`.
