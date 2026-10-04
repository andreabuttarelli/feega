# Legal review checklist — TERMS, PRIVACY, COOKIES, DPA, SUBPROCESSORS, AI-TRANSPARENCY, ACCEPTABLE-USE, LEGAL-NOTICE

## Placeholders

- `[LEGAL ENTITY]`, `[VAT]`, `[ADDRESS]` — the archived drafts named Marco Di Franco (ditta individuale, P.IVA IT18500501004); confirm who operates feega now.
- `[SUPPORT EMAIL]`, `[LEGAL NOTICE EMAIL]` (DSA single point of contact).
- `[DPO]`, `[DPA]` link.
- `[VAT INCLUDED / EXCLUDED]` on plan prices.
- `[REFUND POLICY]`; top-up fate on termination `[REFUNDED / FORFEITED]`.
- Price-change and terms-change notice `[30]` days; liability cap `[12]` months; court `[CITY]`.
- Account deletion flow `[HOW]` — no self-serve deletion found in the code.
- Retention periods: account closure, backups, soft-deleted nodes purge, AI call logs, moderation logs, Sentry, analytics.
- Provider locations: Supabase region, Wiro, TypeSafe/Jev, Zernio, PostHog host, Seline.
- Age verification provider: **Didit** (Didit Identity Spain, S.L.; EU processing, AWS Ireland). Didit is **not** claimed AGCOM-compliant (AGCOM's double-anonymity scheme targets pornographic sites); acceptable because uncensored mode excludes pornographic content. Holds FSM Jugendschutz certification (Germany). Confirm the DPA (Annex 2 of Didit's Business Terms) and that the per-session privacy erasure we request is enough without a console retention setting.

## Points to confirm

1. **Age verification**: whether Italian/EU rules require it for uncensored generation, which certified provider, legal basis for storing the result.
2. **Stripe and adult content**: Stripe restricts adult services; confirm uncensored mode may be sold through Stripe.
3. **Refunds and consumer withdrawal**: waiver wording for credits used within 14 days (Codice del Consumo art. 59).
4. **Liability caps and warranties**: enforceability for consumers vs businesses; conformity guarantee for digital services.
5. **AI Act**: art. 50 labelling duties (provider vs deployer), art. 4 literacy, art. 5 list; machine-readable marking is claimed only "where technically feasible".
6. **DSA**: notice-and-action, statement of reasons, points of contact; hosting-service status given share links.
7. **Credit expiry**: subscription credits expire at period end, welcome credits after 14 days, top-ups never — check against consumer law.
8. **Monthly credit fee per connected social account** — disclosure adequacy.
9. **Consent**: `src/app.html` loads the Google gtag.js conversion tag after interaction or 10 s **without consent gating**; verify Meta Pixel and Seline gating in `src/lib/analytics.ts`. Likely non-compliant until fixed.
10. **Sentry `sendDefaultPii: true`** — justify under legitimate interest or turn off.
11. **Scraping** of public profiles (ScrapeCreators) and websites — legal basis and platform terms.
12. Minimum age 18 for the whole Service.
13. `COOKIES.md` rewritten from the code on 30/09/2026; re-check after the consent fix.
14. Third-party model provider terms passed through to users (Terms §7).

## Placeholders added with the legal set (30/09/2026)

- LEGAL-NOTICE: `[LEGAL FORM]`, `[REA — if applicable]`, `[SHARE CAPITAL — if a company]`, `[PEC]`.
- DPA: `[SIGNED COPY — available on request]`, sub-processor notice `[30]` days, objection refund `[to confirm]`, DSR assistance `[10]` business days, audit notice `[30]` days, `[SECURITY CONTACT]`, `[BACKUP POLICY]`, encryption at rest `[confirm with Supabase plan]`, organisational measures `[to confirm]`.
- SUBPROCESSORS: locations and transfer mechanisms for Wiro, TypeSafe/Jev, Zernio, Seline, Framer; Supabase region; PostHog hosting.
- COOKIES: Supabase auth cookie lifetime, PostHog cookie lifetime, `[FRAMER SITE COOKIES — to list]`.

## Points to confirm — legal set

15. **Consent gaps found in the code** (fix in progress elsewhere; COOKIES §5 describes them): gtag.js conversion tag and Meta Pixel load without consent; server sets `_fbc`/`_fbp` on Meta ad clicks without consent; Seline `cookieOnIdentify` sets a cookie on sign-in; `identifyUser` sends user ID and email to PostHog in the anonymous tier; `openCookieSettings` is not wired to any "Cookie preferences" link. Non-EEA visitors are auto-granted — confirm acceptable.
16. **Sub-processors removed from the code**: Kie.ai, Browserless, Exa, Tavily, Unsplash and Vercel Sandbox are no longer called, and are dropped from SUBPROCESSORS.md.
17. **Google Gemini API** is not called directly (Gemini models go via OpenRouter); dropped from SUBPROCESSORS.md.
23. **Detail level**: Privacy §4 lists recipient categories only (Art. 13(1)(e) allows categories); AI Transparency names no providers; DPA Annex 1 TOMs are generic. Confirm this is sufficient.
18. **DPA**: acceptance by click-through with the Terms vs signature; SCC module choice; whether feega is controller or processor for brand analysis and public-profile scraping; liability cap interplay with GDPR Art. 82.
19. **Breach notice** target 48h — confirm it is operationally achievable.
20. **AI labelling**: only the IPTC XMP marker is live; C2PA signing is off (no certificate, dependency removed) and there is no visible "AI-generated" label outside the uncensored workspace page copy. Confirm "being rolled out" wording is acceptable under Art. 50(2).
21. **Legal notice**: which Art. 7 D.Lgs. 70/2003 fields apply to the chosen legal form.
22. **Framer marketing site**: cookies and its own consent banner.
24. **AI provider retention** (SUBPROCESSORS "What stays at AI providers"): deletion at Wiro and ElevenLabs is best-effort with a 7-day retry window; Wiro keeps task parameters including the prompt; OpenRouter images/videos endpoints and ElevenLabs music, sound effects and isolation are not covered unless a history item is reported. Confirm the wording and whether ZDR or ElevenLabs zero retention is required.

- **Indemnity (TERMS §17):** is the likeness-focused indemnity enforceable against business users, and is the fault-based consumer carve-out enough to avoid an unfair-term finding under Codice del Consumo art. 33?

## DSA / DMCA notice-and-action (02/10/2026)

- [ ] **Register the DMCA designated agent** at [dmca.copyright.gov](https://dmca.copyright.gov) ($6, renew every 3 years), then replace `[DMCA AGENT — registration pending]` in TERMS.md §12A and DMCA.md. Without it the §512(c) safe harbour does not apply.
- [ ] Copy TERMS §12/§12A and DMCA.md to the Framer site (`/terms`, new `/dmca`); the in-app form links to `feega.app/terms`.
- [ ] Confirm the strike policy (1 warning, 2 = 30-day suspension, 3 = termination; likeness ×2, CSAM ×3).
- [ ] Confirm the escalation contacts in `docs/legal/serious-crime-escalation.md` (CNCPO, NCMEC, 112).

## Motion editor (03/10/2026)

- [ ] **Engine licence**: the editor runs on HyperFrames (Apache-2.0). Remotion was tried and removed; if it ever comes back, its company licence is required above 3 employees and server rendering is billed per render (automator pricing). Nothing bought.
- [ ] **AWS Lambda rendering** (not live): adds AWS as a sub-processor for rendered videos once configured.

## Motion 3D look (04/10/2026)

- [ ] **HDRI environments**: Poly Haven files (CC0, no attribution required) served from the three.js repo on jsDelivr, pinned to tag `r181`: `pedestrian_overpass_1k`, `venice_sunset_1k`, `spruit_sunrise_1k`, `quarry_01_1k`, `moonless_golf_1k`. Credit kept in CREDITS.md as courtesy.
- [ ] **3D text fonts**: outlines come from Fontsource on jsDelivr (Google Fonts, SIL OFL / Apache-2.0: embedding in rendered video is allowed) or from the user's uploaded file — the user warrants the rights to an uploaded font (Terms §user content).
- [ ] **opentype.js** 1.3.4 (MIT) loaded in the render page to read font outlines.
