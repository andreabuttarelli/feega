# URL import: always light mode

Two imports of vercel.com came back one light, one dark. The capture
browser (Browserless stealth, or local Chromium) never set
`prefers-color-scheme`, so a site that follows it painted whatever the
session fingerprint said.

`fenced()` in `src/lib/server/web/browser.ts` now emulates
`prefers-color-scheme: light` on every tab. A dark-only site ignores the
media query and stays dark; a site with both schemes always imports in
its default light look. Every tab the app opens (screenshots, browse)
gets the same pin, so captures are comparable across runs.

Discarded: detecting the site's "default" scheme by loading twice:
doubles Browserless cost for a case (dark-by-default sites that also
answer `light`) the media query cannot express anyway.
