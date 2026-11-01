# URL import: many more components

Feedback after importing supabase.com: "you can create MANY more
components". The detector only marked blocks repeated with one exact
style, nothing nested, named by geometry (`Card 2`…`Card 9`, `Button 3`).

What changed:
- The walker keeps `dom` per node: tag, role, a component word from the
  class (`Button_root` → button), landmark (footer, nav, header) and
  `press`, the control whose text is exactly the node's (footer links are
  `li > a > div > text`).
- `component-kinds.ts` is the one table of kinds: Input, Avatar, Tab,
  Accordion item, Badge, Nav link, Button, Footer link, Link, Pricing tier,
  Testimonial, Footer column, Logo, Icon, Feature tile, Card, List item,
  Item. Each row says when it applies, whether one copy is enough, how sets
  merge, whether it nests, and which variant properties it has. The kit's
  `LABELLED`/`STATEFUL` regexes now read it.
- Atoms merge by name (one Button set); molecules merge when alike or when
  they are same-look siblings of one grid. Variant props: Style (Primary…
  by saturation, Outline, Plain), Size, Icon (Leading/Trailing/Only/None),
  Image, Items; `Variant=N` only on collisions.
- Nesting: atoms inside molecules become instances inside the main; a
  nested main gets a home on its own set frame (`setHomes`).
- Link texts and avatar pictures are wrapped in an instance frame of their
  own box.
- Off-page nodes (carousel slides) are never candidates: an off-page main
  drew framer's showcase copies shifted (-0.18 on one band).
- Molecules keep the exact style key: a coarse one linked webflow's editor
  mockups, whose instances then rendered offset.
- `ownOverrides` builds an instance's layers on a doc without clips: each
  addClip re-validated the whole page.
- A state set was named after its main's id (`c1068`); now the main's name.

Measured on capture `rc2` (10 pages): components per page 2–3× (sets
10→18 apple, 9→21 linear, 11→17 supabase), fold/full SSIM within 0.003,
plan time stripe 541 → 475 ms, vercel 87 → 113 ms (4× the instances).

Not done: supabase's header and tweet wall are pictures (blur, mask), so
their links, buttons and cards stay pictures.
