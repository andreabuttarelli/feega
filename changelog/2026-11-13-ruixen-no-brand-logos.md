# Ruixen library without third-party logos

Ruixen's examples ship real companies' logos and wordmarks: 13 SVG files under `/logos`
(Bitbucket, Gong, Gumroad…), logo clouds written as text (Vercel, Linear, Stripe, Notion…),
inline brand SVGs (Salesforce, HubSpot, Google Sheets) and GitHub/LinkedIn icons. The founder
decided none of them ship.

- `scripts/ruixen-library/debrand.ts`: one table, `FICTIONAL`, maps each real name to an invented
  one. Applied to every vendored file at sync (`installable`), so a re-sync cannot bring them back:
  exact string literals and JSX text that are only the brand name, `/logos/<x>.svg` → `/marks/<x>.svg`,
  lucide brand icons → neutral ones (Github → Code, Linkedin → Briefcase…), and local
  `<Brand>Logo|Icon|Mark` SVG components redrawn as a plain circle. Prose that names a product
  ("Plugins for Figma, Framer, Webflow", "Slack support") is left as text.
- `scripts/ruixen-library/marks.ts` draws the replacement marks (a plain shape plus the invented
  name) into `libraries/ruixen/public/marks/`; `publicAssets` never fetches `marks/` upstream.
  `libraries/ruixen/public/logos/` is deleted.
- Recaptured (`ruixen-lib3`) and re-snapshotted: still 155 components. 11 shipped components
  changed; 7 more vendored files belong to items already skipped.
- `ruixen.test.ts` fails if a known brand is a whole text layer in the shipped doc, or if
  `public/logos` or a `/logos/` URL comes back.

Not in scope, left as they are: people's avatars and stock photos (Ruixen's repository
`public/avatar-images`, `testimonial-images`, `card-slides`; an R2 bucket of Ruixen's; Unsplash;
Pinterest's CDN; Gravatar), and brand names in running text.

Known gap: a shipped component that used a `/marks/` image would point at Ruixen's repository,
where the file does not exist; none of the 155 does today.
