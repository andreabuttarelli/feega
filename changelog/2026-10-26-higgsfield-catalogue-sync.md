# Higgsfield models are discovered from its docs

`higgsfield-catalogue.ts` listed 13 endpoints by hand; Higgsfield documents
~80. A model Higgsfield added never appeared until someone typed it.

- Source: `docs.higgsfield.ai/docs/sitemap.xml`, then the `.md` of every
  `models/<family>/<endpoint>` page: `Endpoint ID` and the `Input schema`
  (names, required, defaults, enums, min/max). The API has no public model
  list (`/models` answers 401).
- A page becomes a model only if it has `prompt` and every required input
  without a default is one we fill (prompt, image/video urls).
- Wire fields come from one role table (`ROLES`). Duration and resolution
  are priced through `/estimate`; above 24 combinations the model is
  `quotedAtSubmit` instead.
- Hand-wired entries win over a discovered one with the same endpoint:
  they carry what the docs do not say (reference caps, restyle presets).
- Docs unreachable: only the hand table syncs, as before.
- Wiro was already read live from its tool list; nothing hard-coded to drop.
- Not done: removing rows for endpoints that leave the docs.
