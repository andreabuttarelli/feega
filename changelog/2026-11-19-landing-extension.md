# Landing: Feega is the VS Code extension

The site sold a web app plus a Mac app plus a CLI. Now one message: Feega Inspect, a free VS Code extension (click an element, edit it like in Figma, the change is written to code, no AI).

- Web vs local choice removed (Modes, URL field, signed-in redirect, Mac button in header/footer).
- CTAs in one table, `landing/src/lib/site/links.ts` (EDITORS) and `install.ts`. `EXTENSION_PUBLISHED = false`: CTAs say Coming soon and link to GitHub and a coffee link. Flip it to switch every CTA to the deep link with Marketplace fallback.
- Pricing: free extension, Feega Cloud coming later. llms.txt, FAQ, structured data updated.
- Header "download" replaces "let's start"; the Mac app button is dropped (route /download/mac kept so old links work).
- COFFEE_URL is a placeholder guess; confirm it.
- Possible conflict with feat/feega-inspect on SiteHeader.svelte.
