# Public texts stop promising scheduling, publishing and Meta ads

Scheduling and publishing posts to social accounts (calendar, composer, Zernio) and Meta ad
campaigns left the product on 2026-10-22, and the owner decided they do not come back. Public
texts kept selling them. Removed or rewritten:

- **Landing** (`pages.json`): the calendar/publish and Meta-ad sentences on the ad-maker, 3D, styles
  and node-editor pages; `ai-commercial-maker` stays as a product-video page without Meta; "publish"
  as an end state of a generation became "export". Home FAQ no longer says feega sets platform AI
  labels "when we publish for you".
- **Legal** (Terms §2, §4, §5, §9, §10, §7 licence; Privacy §2, §3, §4; Sub-processors; DPA §2, §3,
  §9; AI Transparency §6; Acceptable Use): the scheduling, Meta-ad and connected-account clauses are
  gone, including the monthly credit fee per connected social account (no code ever charged it) and
  Zernio and Meta Platforms as sub-processors. "Last updated" moved to 16 November 2026.
- **In-app `/docs`**: the section described the old social-media-manager product. Intro,
  getting-started, brands, studio, shopify, webflow, wix and team-invites now redirect (308) to
  docs.feega.app; credits, cli, mcp, agents and api stay, without post/approve/ad-campaign examples
  and with `feega approve`/`feega content` examples that never existed removed. Sitemap lists only
  surviving pages.
- **docs.feega.app** (`web-docs`): `canvas/create-a-post` deleted with a redirect to
  `canvas/nodes-and-connections`; the brand switcher "status at a glance" bullet is gone.
- **Agent/CLI texts**: the "ad campaign ids" operating rule in the skill, the MCP overview, `llms.txt`
  and the Italian API reference (`docs/api/02-brands-core.md`, response shapes now copied from the
  code).
- Two settings strings (delete brand) no longer list posts, plans and connected accounts.

Not touched on purpose: product code, tables, the hidden calendar node, the brand switcher
"scheduled" counts and `plans.ts` highlights ("Autopublish", "Meta Ads"), past public changelog
entries. No public changelog entry: nothing a customer can use changed.
