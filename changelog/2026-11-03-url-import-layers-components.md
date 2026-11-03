# Imported pages: names, components and colours a designer would keep

From the import audit (round 2), measured on fresh captures of vercel, linear and stripe.

- **Names.** `feega-pseudo` (the stand-in for `::before`/`::after`, 4/29/10 layers) and tag names
  on instances (`a`, `button`, `div`) leaked into Layers: instances kept their raw name because
  `named` skipped every boundary node. Tag-named boundaries now take the role name (Link, Button);
  `feega-pseudo` is a raw name. A `<section>`/`<article>` is named after its first words.
- **Components.** Footer columns of different lengths became one main per length (8 on vercel,
  4 on stripe, each used once): a column cannot be an instance of another with a different number
  of links. `Kind.component` (one row in `KINDS`) keeps Footer column as the claim that stops
  `Item` from taking the block, without making it a component; its Footer links stay instances.
  A lone Card or Feature tile is a component only when it is a tile (≤ 40 % of the page wide,
  ≤ 8 texts); before, half-page mock-ups with 19–46 texts were mains. A second set of one role
  outside a named section takes its first words (`Pro plan Card`) before a number.
- **Colours.** Tokens already clustered at ΔE ≤ 1.5, but colours left out of tokens stayed raw:
  stripe held 178 distinct hexes with pairs like `#ffffff`/`#fdfeff`. `coloursMerged` snaps every
  colour of the frame to the most used one within the same ΔE, alpha kept.
- Tests: `page-flatten.test.ts`, `repeated.test.ts`, `page-colours.test.ts`, `url-doc.test.ts`.
