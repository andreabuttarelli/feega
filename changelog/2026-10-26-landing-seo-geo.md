# Landing: agent-first home, Core Web Vitals, SEO and GEO

The home hero was a remote-script iframe: lab LCP 14 s on throttled mobile. It is now static HTML with the local-run prompt (`AGENT_PROMPT`, `LOCAL_COMMANDS` in `home.ts`) and the cloud CTAs under it. Showcase videos load only near the viewport (`lazyPlay`), the display font is subset to Latin (127 KB to 72 KB), landing images ship an 800 px variant via `srcset`, every route is prerendered, `/site/*` is cached immutable.

SEO: titles and descriptions held to 60/160 by `seo.test.ts` (four titles and one description were over), unique per page; breadcrumb JSON-LD from the layout; FAQPage JSON-LD generated from the same `FAQ` the page renders (`plainText` strips links). GEO: `llms.txt` and `llms-full.txt` generated from the page list and FAQ.

Discarded: hreflang (no locales exist), a separate pricing page (pricing is a home section), `font-display: optional` (no change in Lighthouse's simulated LCP, risks a permanent fallback font).
