# Direct links to sheet pages open the canvas

On desktop, loading `/p/<id>/calendar` (or ads, promote, any settings
section) directly showed the page full screen via `DesktopPageBar`, while
the same page opened from the rail was a sheet over the canvas.

Now the project layout decides with `directLoadMode(path, search,
viewport)` (`shell-nav.ts`, one table: family `sheet`, desktop only, OAuth
exemptions) and `restoreSheet` (`sheet-nav.ts`) replaces the history entry
with the canvas, then `pushState`s the sheet URL carrying the `page.data`
already loaded. Reload repeats it; closing goes back to the canvas URL.

Chosen over rendering the canvas underneath inside the layout: that needs
the canvas route's load twice or a second canvas composition. The redirect
reuses the sheet's data (no second load) and loads the canvas once.

SSR can't know the viewport: the shell is `visibility: hidden` at >=768px
while the conversion is pending, so desktop never flashes the full page and
mobile (below 768px) shows it unchanged.

Stay full page: mobile, `settings/facebook|linkedin|connect/*`, and
`?connected=` OAuth returns (connected-accounts reads it from `page.url`,
which inside a sheet is the canvas URL). Target canvas is the first one;
there is no last-canvas memory yet.
