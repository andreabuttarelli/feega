# @feega/pixel-icons

The pixel icons of Feega: one grid and palette in `src/pixel.ts`, rendered to SVG.

- `pixelSvg(icon, size)` returns an SVG string (Astro, plain HTML).
- `Pixel.svelte` renders an icon in Svelte.
- `preview.html` shows every icon by name.

`landing/` and `web-docs/` install on their own, so they hold synced copies. After a change run
`node --experimental-transform-types packages/pixel-icons/sync.mjs`. The inspect webview imports
the package directly.

## Icons

`start` `editing` `stack` `help` `plugin` `templates` `mesh-gradient` `object-3d` `lucide` `brand-logos` `gradient-presets` `phosphor` `heroicons` `shadergradient` `digit-1`
`digit-2` `digit-3` `sign-in` `support` `star` `x` `discord` `coffee` `share` `cursor` `screens` `components` `grid` `sun` `history`
