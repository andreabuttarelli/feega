# Landing ready to take over feega.app: redirects, apex canonicals, speed

feega.app still points at Framer. Before the DNS moves to the `feega-landing` Vercel project,
every URL Framer has indexed must land somewhere, or the ranking is lost.

- **Redirects** (`landing/vercel.json`): `www.feega.app/*` → `feega.app/*` (301; Framer used www
  as canonical), `/compare` → `/blog`, `/compare/:tool` → `/blog/feega-vs-:tool`. The other
  Framer URLs (the ten video landing pages, `/ai-video-upscaler`, legal) already exist at the
  same path. Full map: `~/Documents/feega-videos/landing-port-2/redirects.csv`.
- **Comparisons**: Framer had eight, the blog four. Figma, Pencil.dev, Flora and Canva were
  carried over from the Framer copy (checked 2026-10-28); the existing four took Framer's titles
  and descriptions, since those are what ranks. Each page now emits `Article` JSON-LD.
- **Canonicals** move to the apex through `SITE_URL`; structured data reads it instead of its own
  copy. "Feega" capitalised in titles and schema names.
- **Speed**: the hero video loads only after the poster paints (it was the mobile LCP), the poster
  went from 102 KB to 39 KB, BDO Grotesk was subset to Latin (127 → 79 KB) and Instrument Serif is
  preloaded. `/site/*` lost `immutable`: the files are not hashed, so a replaced poster would have
  stayed stale for a year; hashed `/_app/immutable/*` gets it instead.

Not done: the `/refunds` link from `/terms` still 404s (it did before).
