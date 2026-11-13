# Landing, blog and docs: app favicon, orange logo, "Feega" capitalised

- `landing/` gets the 16 and 32 px PNG favicons the app already ships (SVG, ICO, 48 px PNG and
  apple-touch-icon were byte-identical already). The web manifest is not copied: it describes the
  installable app, not the marketing site.
- Docs: Starlight `logo` with `replacesTitle: false` shows the orange mark beside the name.
  Blog: the same mark inline in the header wordmark. Favicons were already the app's.
- Product name in prose, titles and meta descriptions is "Feega". Left lowercase: URLs, `npx feega`,
  CLI commands, `.feega` files, package names, fenced code, the footer wordmark.
