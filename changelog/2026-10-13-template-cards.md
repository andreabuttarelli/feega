# Template cards: the chat builds videos from library sections

**Why.** The motion agent knew each template by a one-line description, so it built most
videos from scratch. It could not tell an opener from a closer, a calm loop from a fast burst,
or whether two templates chain.

**What.** Every built-in template has a typed card (`src/lib/motion/template/card.ts` model,
`cards.ts` data): roles (opener, feature, product, proof, stat, list, gallery, transition,
closer, background), energy, loops, `onScreen` beat by beat with seconds, needs (media count,
aspect, text amount), best formats, edges (tone at start and end, suggested joint), good for.
Enums live next to the model; what each role means is one table, `ROLE_MEANING`, which the
`list_templates` description prints.

- `card.test.ts` fails when a built-in has no card, an empty field, or beats past its end.
- `list_templates` returns one compact card line and the key fields per template, with a
  `role` filter; `get_template` returns the full card and every typed field. The full field
  specs left the list: 81 templates went from ~99k to ~33k characters, held under 40k by a test.
- `GET /api/v1/motion/templates` carries the card, so `list_motion_templates` (MCP) and
  `feega motion templates` show it.
- Prompt: `TEMPLATE_SECTIONS_RULE` replaces the "ready-made designs" line.
- Eval: `sections` case and `libraryTemplates` fact (distinct templates in the doc), checked ≥2.

`onScreen` comes from frames of the renders in `~/Documents/feega-videos/templates` where one
exists; for launch scenes, apple scenes, designs and compositions it comes from their beats.

**Discarded.** A `card` field on `TemplateEntry`: copying entries broke identity checks in every
template test, and saved team templates have no card. Cards are looked up by id instead.
