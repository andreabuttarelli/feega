# Landing: one plan, priced in euros, with a usage estimator

The home pricing section showed two black blocks — "Local version" and "Cloud version" — with a
usage note in euros ("100 credits = €1, e.g. €8/mo = 800 credits"), a bare "18 / mo" price that
matched no Stripe price, credits explained by arithmetic, and nothing about running out. Its
feature lists also claimed things the product does not have (an "Embed mode"), put MCP under
Cloud only (local mode serves agents too) and promised "unlimited canvases" locally (local mode
is one canvas per `.feega` file).

The section is now one plan: Cloud at €9 per editor per month, each editor adding 500 credits to
a pool the team shares; viewers and AI agents are free. The free tier is one editor with
unlimited viewers; each invited editor needs the plan and adds €9 a month from the day they
accept. The free tier's pitch is bringing your own agent subscription: Claude Code, Claude,
Codex and Cursor (the clients with a documented setup in `web-docs/.../integrations/mcp.mdx`)
edit the canvas up to 1,000 agent-made layers a week (`freeAgentLayersPerWeek`); the plan lifts
the cap. The home FAQ answer about agents now reads from the same text, so it is said once.
The app enforces these rules in a later PR, so this one should not merge before it. The price sits beside its button, a quiet
line points to the free local version, and an estimator takes editors (1–20), images and HD clips
a month, and names the smallest top-up (€10, €20, €50) that covers the gap. Unused credits carry
over; AI pauses when they run out until next month's credits arrive or a top-up.

The plan is data (`landing/src/lib/site/pricing/plan.ts`): price, currency, seat (`per`), included
credits and top-ups are independent fields, because included credits need not equal the price's face value.
Credits are shown as ledger units (100 credits = €1), the unit the app is moving to in the
single-plan work. "About N images / clips" comes from code constants: $0.0748 per image
(`src/lib/image-models.ts`, measured), $0.38 per HD clip (`VIDEO_COST_USD_HD`, an estimate), at
120 credits per provider dollar (`billedCreditsFor`).

Discarded: two equal cards (made Free look as weighty as the paid plan) and a full comparison
table (longest, densest on phones). The home FAQ, the Offer in the structured data (now
`price: 9, priceCurrency: EUR`, per editor per month) and the upscaler Offer currency follow the same facts.
